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
