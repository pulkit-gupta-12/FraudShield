/**
 * Parses simple CSV content into array of objects
 */
export function parseCSV(text) {
  const lines = text.trim().split(/\r\n|\n/)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].trim()
    if (!currentLine) continue
    const values = currentLine.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : ''
    })
    rows.push(row)
  }

  return rows
}

/**
 * Exports array of objects to downloadable CSV
 */
export function exportToCSV(data, filename = 'export.csv') {
  if (!data || !data.length) return

  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((fieldName) => {
          const val = row[fieldName] == null ? '' : String(row[fieldName])
          return `"${val.replace(/"/g, '""')}"`
        })
        .join(',')
    ),
  ]

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Validates transaction CSV columns and structure
 */
export function validateTransactionCSV(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { valid: false, errors: ['The CSV file contains no records or rows.'] }
  }

  const first = rows[0]
  const keys = Object.keys(first).map((k) => k.toLowerCase())
  const errors = []

  const hasAmount = keys.includes('amount') || keys.includes('amountinr') || keys.includes('value')
  if (!hasAmount) {
    errors.push("Missing required transaction value column ('Amount' or 'amountINR').")
  }

  const hasIdentifier =
    keys.includes('time') ||
    keys.includes('timestamp') ||
    keys.includes('id') ||
    keys.includes('transactionid') ||
    keys.includes('cardlast4')
  if (!hasIdentifier) {
    errors.push("Missing transaction identifier or timing column ('Time', 'timestamp', or 'id').")
  }

  return {
    valid: errors.length === 0,
    errors,
    rowCount: rows.length,
    columns: Object.keys(first),
  }
}

/**
 * Generates sample transaction CSV text
 */
export function generateSampleTransactionCSV() {
  const sampleData = [
    { id: 'TXN-901', cardholder: 'Priya Sharma', merchant: 'Flipkart Electronics', category: 'Shopping', amountINR: 4250, city: 'Bengaluru', Time: 104, V1: -1.3598, V2: -0.0727, V3: 2.5363 },
    { id: 'TXN-902', cardholder: 'Rohan Verma', merchant: 'CryptoHub India', category: 'Crypto', amountINR: 84900, city: 'Mumbai', Time: 106, V1: 2.1245, V2: 1.4502, V3: -2.8912 },
    { id: 'TXN-903', cardholder: 'Ananya Iyer', merchant: 'Swiggy Gourmet', category: 'Food & Dining', amountINR: 1250, city: 'Chennai', Time: 112, V1: 0.1241, V2: -0.3214, V3: 1.1042 },
    { id: 'TXN-904', cardholder: 'Vikram Malhotra', merchant: 'JewelCraft Delhi', category: 'Jewelry', amountINR: 124000, city: 'New Delhi', Time: 125, V1: 3.4012, V2: 2.8910, V3: -3.4510 },
    { id: 'TXN-905', cardholder: 'Sneha Patel', merchant: 'Uber India', category: 'Travel', amountINR: 520, city: 'Ahmedabad', Time: 130, V1: -0.4215, V2: 0.1249, V3: 0.8920 },
  ]

  const headers = Object.keys(sampleData[0])
  const lines = [
    headers.join(','),
    ...sampleData.map((row) => headers.map((k) => `"${row[k]}"`).join(',')),
  ]
  return lines.join('\n')
}
