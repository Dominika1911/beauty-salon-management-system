// src/components/UI/Table/Table.tsx
import React, { type ReactElement } from 'react';
import './Table.css';

export interface ColumnDefinition<T> {
  key: keyof T | 'actions';
  header: string;
  render?: (item: T) => React.ReactNode;
  width?: string;
}

interface TableProps<T extends { id: number | string }> {
  data: T[];
  columns: ColumnDefinition<T>[];
  loading?: boolean;
  emptyMessage?: string;
}

export const Table = <T extends { id: number | string }>({
  data,
  columns,
  loading = false,
  emptyMessage = 'Brak danych do wyświetlenia.',
}: TableProps<T>): ReactElement => {
  if (loading) {
    return (
      <div className="custom-table-container">
        <div style={{ padding: 16 }}>Ładowanie…</div>
      </div>
    );
  }

  if (!loading && (!data || data.length === 0)) {
    return (
      <div className="custom-table-container">
        <div style={{ padding: 16 }}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="custom-table-container">
      <table className="custom-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              {columns.map((column) => {
                const rawValue = column.render
                  ? column.render(item)
                  : (item[column.key as keyof T] as React.ReactNode);

                let safeValue: React.ReactNode;
                if (
                  React.isValidElement(rawValue) ||
                  typeof rawValue === 'string' ||
                  typeof rawValue === 'number' ||
                  typeof rawValue === 'boolean' ||
                  rawValue == null
                ) {
                  safeValue = rawValue;
                } else {
                  try {
                    safeValue = JSON.stringify(rawValue);
                  } catch {
                    safeValue = '[obiekt]';
                  }
                }

                return <td key={String(column.key)}>{safeValue}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
