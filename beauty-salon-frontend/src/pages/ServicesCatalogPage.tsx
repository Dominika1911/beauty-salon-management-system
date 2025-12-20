import { useEffect, useState, type ReactElement } from 'react';
import { servicesAPI } from '@/api/services.ts';
import type { Service } from '@/types';

function formatDurationToMinutes(duration: string): string {
  const parts = duration.split(':').map((x) => Number(x));
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    const totalMinutes = parts[0] * 60 + parts[1];
    return `${totalMinutes} min`;
  }
  return duration;
}

export function ServicesCatalogPage(): ReactElement {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadServices = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await servicesAPI.published();
      setServices(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadServices();
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Ładowanie usług…</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Nasze usługi</h1>

      {services.length === 0 && <p>Brak dostępnych usług.</p>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 20,
          marginTop: 20,
        }}
      >
        {services.map((s) => (
          <div
            key={s.id}
            style={{
              border: '1px solid #f3c4cc',
              borderRadius: 12,
              padding: 16,
              backgroundColor: '#fff',
            }}
          >
            <h3 style={{ marginBottom: 8 }}>{s.name}</h3>

            {s.description && <p style={{ marginBottom: 12, color: '#555' }}>{s.description}</p>}

            <p>
              {formatDurationToMinutes(s.duration)}
              <br />
              {s.price} zł
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
