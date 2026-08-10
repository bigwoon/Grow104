# CSV Upload Guide

## 📋 Overview

Four upload scripts for different data types:

1. **Gardeners** (home gardeners/users) - `upload-gardeners.ts`
2. **Gardens** (with vegetables) - `upload-gardens.ts`
3. **Vegetables/Seedlings** - `upload-vegetables.ts`

---

## 🌱 Upload Order (Recommended)

```bash
# 1. First, upload gardeners (creates user accounts)
npx ts-node scripts/upload-gardeners.ts gardeners.csv

# 2. Then, upload vegetables/seedlings (creates the master list)
npx ts-node scripts/upload-vegetables.ts vegetables.csv

# 3. Finally, upload gardens (references vegetables by name and users by email)
npx ts-node scripts/upload-gardens.ts gardens.csv
```

---

## 📄 CSV Formats

### 1. Gardeners CSV

**File**: `gardeners.csv`

**Columns**:
- `2024 Revitalizations` - Status (optional: "Revitalized", "Currently Growing", "Left voicemail", etc.)
- `Home Gardener` - Gardener name (required)
- `Year` - Year category 1-4 (optional)
- `Phone Number` - Contact phone (optional)
- `Address` - Street address (optional)
- `Call in Progress` - Call tracking notes (optional)
- `Email address` - Email (optional, but recommended)
- `Garden Needs` - Comma-separated needs like "Tomatoes, Soil, Fertilizer" (optional)

**Example**:
```csv
2024 Revitalizations,Home Gardener,Year,Phone Number,Address,Call in Progress,Email address,Garden Needs
Revitalized,James Smith,4,817-609-9158,1208 E Allen Ave,Patrice 04/09,jsmith@example.com,"Tomatoes, Okra, Soil"
Currently Growing,Maria Garcia,2,817-555-1234,456 Oak St,Patrice 04/17,maria@example.com,"Lettuce, Fertilizer"
```

**What Gets Created**:
- User account with role "Gardener"
- Random password (users must reset via "Forgot Password")
- GardenerRequest records for supplies and seedlings
- Temporary email if none provided

---

### 2. Vegetables/Seedlings CSV

**File**: `vegetables.csv`

**Columns**:
- `name` - Vegetable/seedling name (required)
- `category` - Category (optional: "Fruit", "Leafy Green", "Root Vegetable", "Legume")
- `description` - Description (optional)

**Example**:
```csv
name,category,description
"Tomatoes","Fruit","Cherry tomatoes"
"Lettuce","Leafy Green","Romaine lettuce"
"Carrots","Root Vegetable","Orange carrots"
```

---

### 2. Gardens CSV (with vegetables)

**File**: `gardens.csv`

**Columns**:
- `name` - Garden name (required)
- `address` - Street address (required)
- `zipcode` - 5-digit zipcode (required)
- `ownerEmail` - Owner's email (must exist in database)
- `description` - Description (optional)
- `latitude` - Latitude coordinate (optional)
- `longitude` - Longitude coordinate (optional)
- `vegetables` - Comma-separated vegetable names (optional)

**Example**:
```csv
name,address,zipcode,ownerEmail,description,latitude,longitude,vegetables
"Community Garden","123 Main St","12345","admin@grow104.org","A beautiful garden",40.7128,-74.0060,"Tomatoes,Lettuce,Carrots"
"Urban Farm","456 Oak Ave","23456","gardener@example.com","Urban farming",40.7589,-73.9851,"Peppers,Cucumbers"
```

---

## 🚀 Usage

### Upload Gardeners
```bash
npx ts-node scripts/upload-gardeners.ts gardeners.csv
```

**Output**:
```
👥 Starting gardener CSV upload...
📄 Parsing CSV file...
✅ Found 75 gardeners in CSV
📤 Uploading to database...
🌱 Line 5: Created "James Smith" with 7 needs
🌿 Line 6: Created "Connie Snow" with 1 needs
⏭️  Line 8: "Suzette G Spears" already exists (email), skipping...
📊 Upload Summary:
  ✅ Created: 65
  ⏭️  Skipped: 8
  ❌ Errors: 2
  📝 Total: 75
💡 Important Notes:
  - All gardeners created with random passwords
  - Users will need to use "Forgot Password" to set their password
```

### Upload Vegetables/Seedlings
```bash
npx ts-node scripts/upload-vegetables.ts vegetables.csv
```

**Output**:
```
🥬 Starting vegetable/seedling CSV upload...
✅ Found 12 vegetables/seedlings in CSV
✅ Line 2: Created "Tomatoes"
✅ Line 3: Created "Lettuce"
⏭️  Line 4: "Carrots" already exists, skipping...
📊 Upload Summary:
  ✅ Created: 10
  ⏭️  Skipped: 2
  📝 Total: 12
```

### Upload Gardens
```bash
npx ts-node scripts/upload-gardens.ts gardens.csv
```

**Output**:
```
🌱 Starting garden CSV upload...
✅ Found 3 gardens in CSV
✅ Line 2: Created "Community Garden" with 3 vegetables
✅ Line 3: Created "Urban Farm" with 2 vegetables
📊 Upload Summary:
  ✅ Success: 3
  ❌ Errors: 0
  📝 Total: 3
```

---

## ⚠️ Important Notes

### Vegetables Must Exist First
- Upload vegetables **before** gardens
- Garden CSV references vegetables by name
- If vegetable doesn't exist, it will be auto-created

### Owner Must Exist
- Owner email must match existing user in database
- Create users first if needed
- Gardens with invalid owners will be skipped

### Duplicate Handling
- **Vegetables**: Skips if name already exists
- **Gardens**: Creates new garden each time (no duplicate check)

---

## 🔧 Troubleshooting

### "Owner not found"
- Verify owner email exists in database
- Check for typos
- Create user account first

### "Vegetable not found" (shouldn't happen)
- Script auto-creates vegetables if missing
- But better to upload vegetables first

### "ts-node not found"
```bash
npm install --save-dev ts-node @types/node
```

---

## 📝 Example Workflow

```bash
# 1. Prepare your CSVs
# - vegetables.csv (list of all vegetables/seedlings)
# - gardens.csv (gardens with their vegetables)

# 2. Upload vegetables first
npx ts-node scripts/upload-vegetables.ts vegetables.csv

# 3. Upload gardens
npx ts-node scripts/upload-gardens.ts gardens.csv

# Done! ✅
```

---

## 🎯 What Gets Created

### Vegetables Upload
- Creates entries in `Vegetable` table
- Skips duplicates

### Gardens Upload
- Creates `Garden` entries
- Creates `GardenInventory` entries (links gardens to vegetables)
- Auto-creates vegetables if they don't exist
- Sets inventory status to "growing"
- Sets quantity to 1 for each vegetable
