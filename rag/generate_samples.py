from fpdf import FPDF
import os

def create_pdf(filename, content):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=10)
    
    for line in content.split("\n"):
        # Replace non-latin1 characters if any
        clean_line = line.encode("ascii", "ignore").decode("ascii")
        pdf.cell(0, 10, clean_line, ln=True)
            
    os.makedirs("./data/samples", exist_ok=True)
    pdf_path = f"./data/samples/{filename}.pdf"
    pdf.output(pdf_path)
    print(f"Created {pdf_path}")

def generate_all():
    businesses = {
        "marios_pizza": """Mario's Pizza and Italian Kitchen
--- MENU ---
- Pepperoni Pizza: Small ($10), Medium ($14), Large ($18)
- Margherita Pizza: Small ($8), Medium ($12), Large ($16)
- Garlic Bread: 5.99
- Beverages: Coke (2.50), Diet Coke (2.50), Sprite (2.50)

--- UPSELLS & SIDES ---
- Extra Cheese: 2.00
- Dipping Sauce (Garlic, Ranch): 1.50
- 2 Liter Coke (Family Pack): 4.50

--- POLICIES ---
- Delivery: Within 5km radius. Delivery fee 3.00.
- Hours: Mon-Sun 11:00 AM - 10:00 PM.""",
        
        "bright_smile_dental": """Bright Smile Dental Clinic
--- SERVICES ---
- Consultation: 50 (20 mins)
- Teeth Cleaning: 120 (45 mins)
- Mole Check: 80 (30 mins)

--- SCHEDULE ---
- Doctors: Dr. Smith (Mon), Dr. Jones (Tue)
- Hours: Mon-Fri 09:00 AM - 05:00 PM.""",

        "sunrise_laundry": """Sunrise Crystal Laundry
--- SERVICES ---
- Wash and Fold: 2.50 per kg
- Dry Cleaning Shirt: 5.00
- Dry Cleaning Jacket: 12.00
- Ironing: 1.50 per item

--- FABRIC CARE ADD-ONS ---
- Extra Foaming Treatment (Deep Clean): 3.50
- Starch Treatment: 1.00
- Fabric Softener: 0.50

--- RULES ---
- Silk: Dry Clean Only.
- Turnaround: 3 Days.""",

        "golden_leaf_teahouse": """The Golden Leaf Tea House
--- TEA MENU ---
- Black Tea: 4.50
- Green Tea: 4.50
- Matcha: 6.00

--- OPTIONS ---
- Size: Regular, Large
- Sweetness: 0, 50, 100
- Ice: No, Less, Normal ice

--- SEATING & BOOKING ---
- Private Tea Tasting Room: 20.00 reservation fee. 
- Max 4 people per room for 60 mins.
- Walk-in counter service available.

--- HOURS ---
- Open Daily: 10:00 AM - 9:00 PM."""
    }
    
    for name, content in businesses.items():
        create_pdf(name, content)

if __name__ == "__main__":
    generate_all()
