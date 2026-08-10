# Garden CSV Upload Script

## Quick Start

1. **Prepare your CSV file** using the template `gardens-example.csv`
2. **Run the upload script**:
   ```bash
   npx ts-node scripts/upload-gardens.ts your-gardens.csv
   ```

## CSV Format

### Required Columns
- `name` - Garden name (min 2 characters)
- `address` - Full street address (min 5 characters)
- `zipcode` - 5-digit zipcode
- `ownerEmail` - Email of existing user in database

### Optional Columns
- `description` - Garden description
- `latitude` - Latitude coordinate (decimal)
- `longitude` - Longitude coordinate (decimal)

### Example CSV
```csv
name,address,zipcode,ownerEmail,description,latitude,longitude
"Community Garden 1","123 Main St","12345","admin@grow104.org","A beautiful garden",40.7128,-74.0060
"Urban Farm","456 Oak Ave","23456","gardener@example.com","Urban farming",40.7589,-73.9851
```

## Features

✅ **Validation**
- Validates all required fields
- Checks email format
- Verifies zipcode format
- Shows all errors before upload

✅ **Error Handling**
- Skips rows with invalid data
- Continues on errors
- Shows detailed error messages
- Summary report at end

✅ **Owner Lookup**
- Finds owner by email
- Skips if owner doesn't exist
- Links garden to correct user

## Usage Examples

### Upload from file
```bash
npx ts-node scripts/upload-gardens.ts gardens.csv
```

### Test with example
```bash
npx ts-node scripts/upload-gardens.ts scripts/gardens-example.csv
```

## Output Example

```
🌱 Starting garden CSV upload...

📄 Parsing CSV file...
✅ Found 3 gardens in CSV

🔍 Validating data...
✅ All data validated

📤 Uploading to database...
✅ Line 2: Created "Community Garden 1"
✅ Line 3: Created "Urban Farm"
⚠️  Line 4: Owner not found (teacher@school.edu), skipping...

📊 Upload Summary:
  ✅ Success: 2
  ❌ Errors: 1
  📝 Total: 3
```

## Troubleshooting

### "Owner not found"
- Make sure the owner email exists in the database
- Check for typos in email addresses
- Create the user first if needed

### "Validation errors"
- Check CSV format matches template
- Verify all required fields are present
- Ensure zipcode is 5 digits
- Verify email format is valid

### "CSV file not found"
- Check file path is correct
- Use relative or absolute path
- Make sure file has .csv extension

## Notes

- Script connects directly to Neon database
- Uses DATABASE_URL from .env file
- No Vercel endpoint needed
- Can upload unlimited gardens
- Safe to run multiple times (creates new gardens each time)
