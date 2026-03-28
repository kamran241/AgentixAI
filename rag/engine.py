import os
import shutil
import gc
import time
from typing import List, Tuple

from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

class ColumnSchema(BaseModel):
    name: str = Field(description="Column name in snake_case")
    type: str = Field(description="SQL Type (TEXT, INTEGER, REAL, etc)")

class TableSchema(BaseModel):
    table_name: str = Field(description="SQL table name in snake_case")
    columns: List[ColumnSchema] = Field(description="Table columns")

class BusinessRule(BaseModel):
    category: str = Field(description="Rule category")
    rule_details: str = Field(description="Specific rule details")

class BusinessIdentity(BaseModel):
    name: str = Field(description="Business name")
    type: str = Field(description="Business type")
    description: str = Field(description="Business description")
    primary_services: List[str] = Field(description="Main services")
    rules: List[BusinessRule] = Field(description="Extracted rules")
    suggested_orders_table: TableSchema = Field(description="Table schema for orders")

class RAGEngine:
    def __init__(self):
        print("Initializing RAGEngine...")
        # Use OpenAI Embeddings as primary for consistency and reliability
        self.embeddings = OpenAIEmbeddings()
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        self.persist_directory = os.path.join(os.getcwd(), "data", "chroma_db")
        self.collection_name = "business_knowledge"
        self.vectorstore = None
        
        # Ensure directory exists
        os.makedirs(self.persist_directory, exist_ok=True)
        print(f"RAG Persist Directory: {self.persist_directory}")

    def ingest_business_file(self, file_path: str) -> BusinessIdentity:
        print(f"--- Starting Ingestion: {file_path} ---")
        
        # 1. Load Data
        if file_path.endswith('.pdf'):
            loader = PyPDFLoader(file_path)
            docs = loader.load()
            full_text = "\n".join([doc.page_content for doc in docs[:15]])
        else:
            loader = TextLoader(file_path, encoding='utf-8')
            docs = loader.load()
            full_text = docs[0].page_content
        
        print(f"Loaded {len(docs)} document pages.")

        # 2. Extract Business Identity
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a world-class business analyst. Extract business identity and design a specific SQL table for their operations."),
            ("user", "{text}")
        ])
        chain = prompt | self.llm.with_structured_output(BusinessIdentity)
        identity = chain.invoke({"text": full_text})
        
        # --- Requirement 5/6: Knowledge Enrichment ---
        enrichment_prompt = f"""
        Based on this business: {identity.name} ({identity.type}) - {identity.description}
        Extract several 'Implicit Rules' or 'Enriched Skills' not explicitly mentioned in a basic PDF but useful for an assistant.
        Examples: Upsell combinations (e.g. suggesting fries with burgers), typical service add-ons, or customer service heuristics.
        
        Generate 3-5 enriched business rules.
        """
        class EnrichedRules(BaseModel):
            new_rules: List[BusinessRule]
            
        enrichment_chain = ChatPromptTemplate.from_template(enrichment_prompt) | self.llm.with_structured_output(EnrichedRules)
        enrichment = enrichment_chain.invoke({})
        identity.rules.extend(enrichment.new_rules)
        print(f"Enriched Identity with {len(enrichment.new_rules)} additional skills/rules.")
        # ---------------------------------------------
        
        print(f"Extracted Identity: {identity.name} ({identity.type})")

        # 3. Robust Vector Store Reset
        print("Resetting Vector Store...")
        self.vectorstore = None
        gc.collect()
        
        # Physical Deletion Attempt
        if os.path.exists(self.persist_directory):
            for i in range(3): # Try 3 times to handle Windows locks
                try:
                    shutil.rmtree(self.persist_directory)
                    break
                except Exception as e:
                    print(f"Retry {i+1}: Could not delete directory: {e}")
                    time.sleep(0.5)
        
        os.makedirs(self.persist_directory, exist_ok=True)

        # 4. Chunk & Index
        splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)
        splits = splitter.split_documents(docs)
        print(f"Created {len(splits)} text chunks.")

        if splits:
            self.vectorstore = Chroma.from_documents(
                documents=splits,
                embedding=self.embeddings,
                persist_directory=self.persist_directory,
                collection_name=self.collection_name
            )
            # For some versions of LangChain, persist() needs to be called
            if hasattr(self.vectorstore, 'persist'):
                self.vectorstore.persist()
            print("Successfully indexed and persisted knowledge.")
        else:
            print("FAIL: No splits created from document.")

        return identity

    def get_retriever(self):
        if self.vectorstore is None:
            print("Loading VectorStore from disk...")
            try:
                self.vectorstore = Chroma(
                    persist_directory=self.persist_directory,
                    embedding_function=self.embeddings,
                    collection_name=self.collection_name
                )
                count = self.vectorstore._collection.count()
                print(f"VectorStore loaded. Current document count: {count}")
            except Exception as e:
                print(f"Error loading VectorStore: {e}")
                return None
                
        return self.vectorstore.as_retriever(search_kwargs={"k": 5})

    def query_knowledge(self, query: str) -> Tuple[str, List]:
        """Requirement 7: LLM-based relevance matching instead of pure embeddings."""
        retriever = self.get_retriever()
        if not retriever:
            return "Knowledge base not initialized.", []
            
        # 1. Retrieve a larger set of potential chunks via vector search
        initial_docs = retriever.invoke(query) # Default is k=5
        if not initial_docs:
            return "", []
            
        # 2. LLM-based Matching (Relevance Filtering)
        # We ask the LLM to look at these 5 chunks and only pick the ones that actually answer the query.
        chunks_text = "\n---\n".join([f"Chunk {i}: {doc.page_content}" for i, doc in enumerate(initial_docs)])
        
        relevance_prompt = f"""
        Human Query: {query}
        
        Below are several text chunks from a business PDF. 
        Identify which chunks (if any) are RELEVANT to answering the query.
        If a chunk is relevant, keep its text. If not, discard it.
        
        Chunks:
        {chunks_text}
        
        Task: Return only the combined text of the RELEVANT chunks. If none are relevant, return 'No relevant information found'.
        """
        
        response = self.llm.invoke(relevance_prompt)
        context = response.content.strip()
        
        print(f"LLM-based matching found {len(context)} chars of relevant context.")
        return context, initial_docs
