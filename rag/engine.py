import os
import shutil
import gc
import time
from typing import List, Tuple, Optional

from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()


class ColumnSchema(BaseModel):
    name: str = Field(description="Column name in snake_case, no spaces")
    type: str = Field(description="SQL type: TEXT, INTEGER, REAL, or DATETIME")


class TableSchema(BaseModel):
    table_name: str = Field(description="SQL table name in snake_case, e.g. customer_orders")
    purpose: str = Field(description="One sentence describing what this table stores, e.g. 'Stores customer pizza orders with items and delivery details'")
    columns: List[ColumnSchema] = Field(
        description=(
            "Columns for this table. ALWAYS include these three columns in every table: "
            "customer_name (TEXT), customer_phone (TEXT), customer_email (TEXT). "
            "For booking/appointment tables also include an appointment_time (DATETIME) column. "
            "Never omit customer_name, customer_phone, or customer_email."
        )
    )


class BusinessRule(BaseModel):
    category: str = Field(description="Rule category, e.g. Pricing, Hours, Policy")
    rule_details: str = Field(description="Specific rule details")


class BusinessIdentity(BaseModel):
    name: str = Field(description="Business name")
    type: str = Field(description="Business type, e.g. Pizza Restaurant, Dental Clinic")
    description: str = Field(description="One sentence description of the business")
    primary_services: List[str] = Field(description="List of main services or products offered")
    rules: List[BusinessRule] = Field(description="Extracted business rules and policies")
    suggested_tables: List[TableSchema] = Field(
        description="List of SQL tables needed for this business. Design 1-3 tables that cover all operational data (orders, bookings, customer info, etc). Each table should serve a distinct purpose."
    )
    has_orders: bool = Field(description="True if this business takes product or service orders (food, retail, laundry, etc)")
    has_bookings: bool = Field(description="True if this business handles time-based appointments or reservations (dental, salon, hotel, etc)")
    has_delivery: bool = Field(description="True if this business delivers to customer addresses and needs address validation")


class RAGEngine:
    def __init__(self):
        print("Initializing RAGEngine...")
        self.embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        self.llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
        self.base_directory = os.getenv("CHROMA_DIR", os.path.join(os.getcwd(), "data", "chroma_db"))
        self.vectorstores: dict = {}
        os.makedirs(self.base_directory, exist_ok=True)
        print(f"RAG base directory: {self.base_directory}")

    def _get_persist_dir(self, business_id: int) -> str:
        return os.path.join(self.base_directory, str(business_id))

    def ingest_business_file(self, file_path: str, business_id: int) -> BusinessIdentity:
        print(f"--- Starting Ingestion for business_id={business_id}: {file_path} ---")

        if file_path.endswith('.pdf'):
            loader = PyPDFLoader(file_path)
            docs = loader.load()
            full_text = "\n".join([doc.page_content for doc in docs[:15]])
        else:
            loader = TextLoader(file_path, encoding='utf-8')
            docs = loader.load()
            full_text = docs[0].page_content

        print(f"Loaded {len(docs)} pages.")

        # Extract full business identity including multi-table schema
        prompt = ChatPromptTemplate.from_messages([
            ("system", (
                "You are a world-class business analyst and database architect. "
                "Read this business document and:\n"
                "1. Extract the business identity and rules.\n"
                "2. Design the minimal set of SQL tables (1-3) needed to store all operational data for this business. "
                "Think carefully about what data this specific business needs to track — an order-based business needs "
                "different tables than an appointment-based one.\n"
                "3. Identify whether the business uses orders, bookings, and/or delivery."
            )),
            ("user", "{text}")
        ])
        chain = prompt | self.llm.with_structured_output(BusinessIdentity)
        identity = chain.invoke({"text": full_text})

        # Enrich with implicit rules
        enrichment_prompt = f"""
Business: {identity.name} ({identity.type}) — {identity.description}

Generate 3-5 implicit business rules or upsell heuristics that a skilled assistant would know,
even if not explicitly in the document. Examples: upsell combinations, service add-ons, customer service heuristics.
"""
        class EnrichedRules(BaseModel):
            new_rules: List[BusinessRule]

        enrichment_chain = ChatPromptTemplate.from_template(enrichment_prompt) | self.llm.with_structured_output(EnrichedRules)
        enrichment = enrichment_chain.invoke({})
        identity.rules.extend(enrichment.new_rules)

        print(f"Extracted {len(identity.suggested_tables)} tables, {len(identity.rules)} rules. "
              f"Capabilities: orders={identity.has_orders}, bookings={identity.has_bookings}, delivery={identity.has_delivery}")

        # Reset vectorstore for this business
        persist_dir = self._get_persist_dir(business_id)
        self.vectorstores.pop(business_id, None)
        gc.collect()

        if os.path.exists(persist_dir):
            for i in range(3):
                try:
                    shutil.rmtree(persist_dir)
                    break
                except Exception as e:
                    print(f"Retry {i+1}: Could not delete chroma dir: {e}")
                    time.sleep(0.5)

        os.makedirs(persist_dir, exist_ok=True)

        splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)
        splits = splitter.split_documents(docs)
        print(f"Created {len(splits)} text chunks.")

        if splits:
            self.vectorstores[business_id] = Chroma.from_documents(
                documents=splits,
                embedding=self.embeddings,
                persist_directory=persist_dir,
                collection_name=f"business_{business_id}"
            )
            if hasattr(self.vectorstores[business_id], 'persist'):
                self.vectorstores[business_id].persist()
            print(f"Knowledge indexed for business_id={business_id}.")
        else:
            print("FAIL: No splits created from document.")

        return identity

    def get_retriever(self, business_id: int):
        if business_id not in self.vectorstores:
            persist_dir = self._get_persist_dir(business_id)
            print(f"Loading vectorstore from disk for business_id={business_id}...")
            try:
                self.vectorstores[business_id] = Chroma(
                    persist_directory=persist_dir,
                    embedding_function=self.embeddings,
                    collection_name=f"business_{business_id}"
                )
                count = self.vectorstores[business_id]._collection.count()
                print(f"VectorStore loaded. Document count: {count}")
            except Exception as e:
                print(f"Error loading vectorstore for business_id={business_id}: {e}")
                return None

        count = self.vectorstores[business_id]._collection.count()
        k = max(1, min(5, count))
        return self.vectorstores[business_id].as_retriever(search_kwargs={"k": k})

    def query_knowledge(self, query: str, business_id: Optional[int]) -> Tuple[str, List]:
        if not business_id:
            return "Knowledge base not initialized — no active business.", []

        retriever = self.get_retriever(business_id)
        if not retriever:
            return "Knowledge base not initialized.", []

        initial_docs = retriever.invoke(query)
        if not initial_docs:
            return "", []

        chunks_text = "\n---\n".join([f"Chunk {i}: {doc.page_content}" for i, doc in enumerate(initial_docs)])

        relevance_prompt = f"""
Human Query: {query}

Below are text chunks from a business PDF. Return only the combined text of chunks RELEVANT to answering the query. If none are relevant, return 'No relevant information found'.

Chunks:
{chunks_text}
"""
        response = self.llm.invoke(relevance_prompt)
        context = response.content.strip()
        print(f"RAG: {len(context)} chars of relevant context returned.")
        return context, initial_docs
