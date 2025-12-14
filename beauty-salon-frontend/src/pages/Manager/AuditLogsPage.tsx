import { useEffect, useMemo, useState } from 'react';
import { auditLogsAPI, type AuditLog } from '../../api/auditLogs';
import { Table, type ColumnDefinition } from '../../components/UI/Table/Table';
import '../../components/UI/Table/Table.css';

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

// skraca np. "appointment.change_status" -> "change_status"
const shortType = (t: string): string => {
  const parts = t.split('.');
  return parts[parts.length - 1] || t;
};

export default function AuditLogsPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const list = await auditLogsAPI.list(level ? { level } : undefined);
      setItems(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const columns: ColumnDefinition<AuditLog>[] = useMemo(
    () => [
      {
        key: 'created_at',
        header: 'Data',
        render: (r) => formatDateTime(r.created_at),
        width: '170px',
      },
      { key: 'level_display', header: 'Poziom', width: '130px' },
      {
        key: 'type',
        header: 'Typ',
        render: (r) => shortType(r.type),
        width: '170px',
      },
      { key: 'user_email', header: 'Użytkownik', width: '220px' },
      { key: 'message', header: 'Opis' },
    ],
    []
  );

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <h1>Logi operacji</h1>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label>
            Poziom:&nbsp;
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Wszystkie</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </label>

          <button className="btn" onClick={() => void load()}>
            Odśwież
          </button>
        </div>
      </div>

      <Table data={items} columns={columns} loading={loading} emptyMessage="Brak logów." />
    </div>
  );
}
