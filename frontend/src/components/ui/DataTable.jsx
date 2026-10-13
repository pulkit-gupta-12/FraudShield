import React, { useState, useMemo } from 'react'
import clsx from 'clsx'
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Inbox,
} from 'lucide-react'

/**
 * Reusable, sortable, searchable and paginated DataTable.
 * 
 * @param {Array<{key: string, header: string, render?: (row: any) => React.ReactNode, sortable?: boolean, align?: 'left'|'center'|'right'}>} columns
 * @param {Array<any>} data
 * @param {boolean} [loading=false]
 * @param {(row: any) => void} [onRowClick]
 * @param {boolean} [searchable=true]
 * @param {string} [searchPlaceholder='Filter table...']
 * @param {React.ReactNode} [filterSlot]
 * @param {boolean} [pagination=true]
 * @param {number} [pageSize=10]
 * @param {React.ReactNode} [emptyMessage='No records found']
 */
export function DataTable({
  columns = [],
  data = [],
  loading = false,
  onRowClick,
  searchable = true,
  searchPlaceholder = 'Filter table...',
  filterSlot,
  pagination = true,
  pageSize = 10,
  emptyMessage = 'No records found',
  className = '',
}) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortOrder, setSortOrder] = useState('asc') // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1)

  // Filter rows by search
  const filteredData = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key]
        return val != null && String(val).toLowerCase().includes(q)
      })
    )
  }, [data, search, columns])

  // Sort rows
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal === bVal) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      const res = aVal > bVal ? 1 : -1
      return sortOrder === 'asc' ? res : -res
    })
  }, [filteredData, sortKey, sortOrder])

  // Paginate rows
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData
    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, pagination, currentPage, pageSize])

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') setSortOrder('desc')
      else {
        setSortKey(null)
        setSortOrder('asc')
      }
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  return (
    <div className={clsx('bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs', className)}>
      {/* Table Toolbar */}
      {(searchable || filterSlot) && (
        <div className="p-4 border-b border-neutral-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-50/50">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition"
              />
            </div>
          )}
          {filterSlot && <div className="flex items-center gap-2">{filterSlot}</div>}
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider text-[11px]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={clsx(
                    'py-3 px-4 select-none',
                    col.sortable !== false ? 'cursor-pointer hover:text-neutral-900 transition' : '',
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  )}
                >
                  <div
                    className={clsx(
                      'inline-flex items-center gap-1.5',
                      col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'
                    )}
                  >
                    <span>{col.header}</span>
                    {col.sortable !== false && (
                      <span className="text-neutral-400">
                        {sortKey === col.key ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-primary-600" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-primary-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100 text-neutral-700">
            {loading ? (
              // Loading Skeleton
              Array.from({ length: pageSize > 6 ? 6 : pageSize }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className="py-3.5 px-4">
                      <div className="h-4 bg-neutral-100 rounded-md w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-neutral-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Inbox className="w-8 h-8 text-neutral-300 stroke-[1.5]" />
                    <p className="text-xs font-medium text-neutral-500">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              // Rows
              paginatedData.map((row, rIdx) => (
                <tr
                  key={row.id || rIdx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={clsx(
                    'transition-colors',
                    onRowClick ? 'cursor-pointer hover:bg-primary-50/40' : 'hover:bg-neutral-50/60'
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        'py-3.5 px-4',
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      )}
                    >
                      {col.render ? col.render(row) : row[col.key] != null ? String(row[col.key]) : '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && !loading && sortedData.length > 0 && (
        <div className="px-4 py-3 border-t border-neutral-100 flex items-center justify-between gap-4 bg-neutral-50/30">
          <p className="text-xs text-neutral-500">
            Showing <span className="font-semibold text-neutral-800">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-semibold text-neutral-800">
              {Math.min(currentPage * pageSize, sortedData.length)}
            </span>{' '}
            of <span className="font-semibold text-neutral-800">{sortedData.length}</span> entries
          </p>

          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-semibold px-2 text-neutral-700">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
