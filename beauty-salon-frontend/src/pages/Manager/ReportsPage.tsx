import { useEffect, useMemo, useState } from 'react';
import { reportsAPI, type ReportPDF } from '../../api/reports';
import { Table, type ColumnDefinition } from '../../components/UI/Table/Table';
import '../../components/UI/Table/Table.css';

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

export default function ReportsPage() {
  const [items, setItems] = useState<ReportPDF[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const list = await reportsAPI.list(typeFilter ? { type: typeFilter } : undefined);
      setItems(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const columns: ColumnDefinition<ReportPDF>[] = useMemo(
    () => [
      {
        key: 'created_at',
        header: 'Utworzono',
        render: (r) => formatDateTime(r.created_at),
        width: '175px',
      },
      { key: 'type', header: 'Typ', width: '110px' },
      { key: 'title', header: 'Tytuł' },
      {
        key: 'data_od',
        header: 'Od',
        render: (r) => formatDate(r.data_od),
        width: '110px',
      },
      {
        key: 'data_do',
        header: 'Do',
        render: (r) => formatDate(r.data_do),
        width: '110px',
      },
      {
        key: 'actions',
        header: 'PDF',
        render: (r: ReportPDF) => (
          <a
            className="btn btn-sm btn-nowrap"
            href={reportsAPI.mediaUrl(r.file_path)}
            target="_blank"
            rel="noreferrer"
          >
            PDF
          </a>
        ),
        width: '120px',
      },
    ],
    []
  );

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <h1>Raporty (PDF)</h1>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label>
            Typ:&nbsp;
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Wszystkie</option>
              <option value="monthly">Miesięczny</option>
              <option value="annual">Roczny</option>
              <option value="custom">Niestandardowy</option>
              <option value="financial">Finansowy</option>
            </select>
          </label>

          <button className="btn" onClick={() => void load()}>
            Odśwież
          </button>
        </div>
      </div>

      <Table data={items} columns={columns} loading={loading} emptyMessage="Brak raportów." />
    </div>
  );
}
