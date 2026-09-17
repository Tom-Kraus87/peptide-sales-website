import json
import os
import re

import pandas as pd

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCEL_CANDIDATES = [
    os.path.join(BASE, "peptide_categorized_descriptions.xlsx"),
    os.path.join(BASE, "peptide_temp.xlsx"),
]
IMAGES_DIR = os.path.join(BASE, "vial images")
OUTPUT_PATH = os.path.join(BASE, "data", "products.json")
DATA_SCRIPT_PATH = os.path.join(BASE, "js", "products-data.js")

MANUAL_PRODUCTS = [
    {
        "sku": "AD10",
        "name": "Adamax",
        "strength": "10mg • 1 vial",
        "category": "Cognitive / sleep / nervous system",
        "description": "Research compound marketed for cognitive and nervous-system studies.",
        "caution": "Research-use product; safety and efficacy are not established.",
        "status": "Research",
        "sourceUrls": [],
        "image": "images/actual-products/adamax-10mg.jpg",
    },
    {
        "sku": "TSM20",
        "name": "Tesamorelin",
        "strength": "20mg • 10 vials",
        "category": "Growth hormone / IGF axis",
        "description": (
            "Growth hormone-releasing factor analog used by prescription to reduce "
            "excess abdominal fat in adults with HIV-associated lipodystrophy."
        ),
        "caution": "Not a general weight-loss drug; prescription-only context.",
        "status": "FDA-approved drug exists",
        "sourceUrls": [
            "https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/022505s020lbl.pdf",
            "https://www.mayoclinic.org/drugs-supplements/tesamorelin-subcutaneous-route/description/drg-20074632",
        ],
        "image": "vial images/TSM10_Tesamorelin_10mg_10_vials.png",
    },
]


def resolve_excel_path():
    for path in EXCEL_CANDIDATES:
        try:
            with open(path, "rb"):
                return path
        except OSError:
            continue
    raise FileNotFoundError("Could not open peptide Excel workbook.")


def clean_text(value):
    if pd.isna(value):
        return ""
    text = str(value)
    text = text.replace("\u2013", "-").replace("\u2014", "-").replace("\ufffd", "-")
    return text.strip()


def build_image_map():
    image_map = {}
    for filename in os.listdir(IMAGES_DIR):
        if not filename.lower().endswith(".png"):
            continue
        sku = filename.split("_")[0]
        image_map[sku] = filename
    return image_map


def parse_strengths(strength_text):
    if not strength_text:
        return []
    parts = re.split(r";", strength_text)
    return [part.strip() for part in parts if part.strip()]


def sku_sort_key(sku):
    match = re.match(r"^([A-Za-z]+)(\d+)(.*)$", sku or "")
    if not match:
        return (sku or "", 0, "")
    return (match.group(1), int(match.group(2)), match.group(3))


def main():
    excel_path = resolve_excel_path()
    sku_df = pd.read_excel(excel_path, sheet_name="SKU Index")
    desc_df = pd.read_excel(excel_path, sheet_name="Descriptions")
    image_map = build_image_map()

    descriptions = {}
    for _, row in desc_df.iterrows():
        descriptions[clean_text(row["Product Name"])] = {
            "category": clean_text(row["Category"]),
            "description": clean_text(row["What it is / what it does"]),
            "caution": clean_text(row["Caution / status notes"]),
            "status": clean_text(row["Status"]),
            "sourceUrls": [
                url.strip()
                for url in clean_text(row["Source URL(s)"]).split("\n")
                if url.strip()
            ],
        }

    products = []
    categories = {}

    for _, row in sku_df.iterrows():
        sku = clean_text(row["SKU Code"])
        product_name = clean_text(row["Product Name"])
        strength = clean_text(row["Strength / Package"])
        category = clean_text(row["Category"])
        status = clean_text(row["Status"])
        image_file = image_map.get(sku)
        product_info = descriptions.get(product_name, {})

        product = {
            "sku": sku,
            "name": product_name,
            "strength": strength,
            "category": category or product_info.get("category", "Other"),
            "description": product_info.get("description", ""),
            "caution": product_info.get("caution", ""),
            "status": status or product_info.get("status", ""),
            "sourceUrls": product_info.get("sourceUrls", []),
            "image": f"vial images/{image_file}" if image_file else None,
        }
        products.append(product)
        categories.setdefault(product["category"], []).append(product_name)

    existing_skus = {product["sku"] for product in products}
    for product in MANUAL_PRODUCTS:
        if product["sku"] in existing_skus:
            continue
        products.append(product)
        categories.setdefault(product["category"], []).append(product["name"])

    category_summary = [
        {"name": name, "count": len(set(items))}
        for name, items in sorted(categories.items())
    ]

    payload = {
        "generatedAt": pd.Timestamp.now("UTC").isoformat(),
        "productCount": len(products),
        "categories": category_summary,
        "products": sorted(
            products,
            key=lambda item: (
                item["category"],
                item["name"],
                sku_sort_key(item["sku"]),
            ),
        ),
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)

    os.makedirs(os.path.dirname(DATA_SCRIPT_PATH), exist_ok=True)
    with open(DATA_SCRIPT_PATH, "w", encoding="utf-8") as handle:
        handle.write("window.CATALOG_DATA = ")
        json.dump(payload, handle, ensure_ascii=False)
        handle.write(";\n")

    matched = sum(1 for product in products if product["image"])
    print(
        f"Wrote {len(products)} products ({matched} with images) to "
        f"{OUTPUT_PATH} and {DATA_SCRIPT_PATH}"
    )


if __name__ == "__main__":
    main()
