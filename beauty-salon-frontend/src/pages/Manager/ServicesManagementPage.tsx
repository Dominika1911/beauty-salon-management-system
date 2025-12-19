import React, { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { servicesAPI } from '@/shared/api/services';
import { ServiceFormModal } from '@/features/manager/components/ServiceFormModal';
import { usePagination } from '@/shared/hooks/usePagination';
import { useAuth } from '@/shared/hooks/useAuth';
import type { PaginatedResponse, Service } from '@/shared/types';
import {
  beautyButtonDangerStyle,
  beautyButtonSecondaryStyle,
  beautyCardBodyStyle,
  beautyCardHeaderStyle,
  beautyCardStyle,
  beautyInputStyle,
  beautyMutedTextStyle,
  beautyPageTitleStyle,
  beautySelectStyle,
} from '@/shared/utils/ui';

const PAGE_SIZE = 20;

type Banner = { type: 'success' | 'error'; text: string };
type PublishFilter = 'all' | 'published' | 'unpublished';

type PendingAction =
  | { kind: 'toggle_publish'; service: Service }
  | { kind: 'delete'; service: Service };

function formatPricePLN(price: string): string {
  const n = Number(price);
  if (!Number.isFinite(n)) return `${price} PLN`;
  return `${n.toFixed(2)} PLN`;
}

function formatDurationHHmm(duration: string): string {
  // backend daje zwykle "HH:MM:SS" albo "HH:MM"
  if (duration.length >= 5) return duration.slice(0, 5);
  return duration;
}

function extractErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;
    if (typeof data === 'string') return status ? `HTTP ${status}: ${data}` : data;
    if (data && typeof data === 'object') {
      try {
        return status ? `HTTP ${status}: ${JSON.stringify(data)}` : JSON.stringify(data);
      } catch {
        return status ? `HTTP ${status}: [Błąd odpowiedzi]` : '[Błąd odpowiedzi]';
      }
    }
    return status ? `HTTP ${status}: ${err.message}` : err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Nieznany błąd.';
}

const pillStyle = (kind: 'ok' | 'warn'): CSSProperties => ({
  display: 'inline-block',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  border: '1px solid',
  borderColor: kind === 'ok' ? '#9ad5b3' : '#f2a6b3',
  backgroundColor: kind === 'ok' ? '#e9fff1' : '#fff1f3',
  color: '#5a2a35',
});

export const ServicesManagementPage: React.FC = (): ReactElement => {
  const { isManager } = useAuth();

  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const [search, setSearch] = useState<string>('');
  const [publishFilter, setPublishFilter] = useState<PublishFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [serviceToEdit, setServiceToEdit] = useState<Service | undefined>(undefined);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const {
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    setTotalCount,
    setCurrentPage,
    handlePreviousPage,
    handleNextPage,
  } = usePagination(PAGE_SIZE);

  const fetchServices = async (page: number, size: number): Promise<void> => {
    setLoading(true);
    setBanner(null);
    try {
      const params: { page: number; page_size: number; search?: string; category?: string; is_published?: boolean } = {
        page,
        page_size: size,
      };

      if (search.trim()) params.search = search.trim();
      if (categoryFilter.trim()) params.category = categoryFilter.trim();
      if (publishFilter === 'published') params.is_published = true;
      if (publishFilter === 'unpublished') params.is_published = false;

      const response = await servicesAPI.list(params);
      const data = response.data as PaginatedResponse<Service>;
      setItems(data.results);
      setTotalCount(data.count);
    } catch (e) {
      setItems([]);
      setTotalCount(0);
      setBanner({ type: 'error', text: `Nie udało się pobrać usług. ${extractErrorMessage(e)}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchServices(currentPage, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Zmiana filtrów -> wróć na 1 stronę
  useEffect(() => {
    setCurrentPage(1);
    void fetchServices(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, publishFilter, categoryFilter]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => {
      if (i.category) s.add(i.category);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pl-PL'));
  }, [items]);

  const sortedItems = useMemo(() => [...items].sort((a, b) => a.id - b.id), [items]);

  const closeModal = (): void => {
    setModalOpen(false);
    setServiceToEdit(undefined);
  };

  const onModalSuccess = (): void => {
    closeModal();
    setBanner({ type: 'success', text: 'Zapisano usługę.' });
    setCurrentPage(1);
    void fetchServices(1, pageSize);
  };

  const requestTogglePublish = (service: Service): void => {
    setPendingAction({ kind: 'toggle_publish', service });
    setBanner(null);
  };

  const requestDelete = (service: Service): void => {
    setPendingAction({ kind: 'delete', service });
    setBanner(null);
  };

  const cancelPending = (): void => {
    setPendingAction(null);
  };

  const confirmPending = async (): Promise<void> => {
    if (!pendingAction) return;
    setLoading(true);
    setBanner(null);
    try {
      if (pendingAction.kind === 'toggle_publish') {
        const s = pendingAction.service;
        await servicesAPI.update(s.id, { is_published: !s.is_published });
        setBanner({
          type: 'success',
          text: !s.is_published ? `Opublikowano usługę #${s.id}.` : `Wycofano usługę #${s.id}.`,
        });
      } else {
        const s = pendingAction.service;
        await servicesAPI.delete(s.id);
        setBanner({ type: 'success', text: `Usunięto usługę #${s.id}.` });
      }

      setPendingAction(null);
      void fetchServices(currentPage, pageSize);
    } catch (e) {
      setBanner({ type: 'error', text: `Nie udało się wykonać operacji. ${extractErrorMessage(e)}` });
    } finally {
      setLoading(false);
    }
  };

  const pendingText = useMemo(() => {
    if (!pendingAction) return null;
    if (pendingAction.kind === 'toggle_publish') {
      return pendingAction.service.is_published
        ? `Czy na pewno chcesz wycofać z publikacji usługę „${pendingAction.service.name}” (#${pendingAction.service.id})?`
        : `Czy na pewno chcesz opublikować usługę „${pendingAction.service.name}” (#${pendingAction.service.id})?`;
    }
    return `Czy na pewno chcesz usunąć usługę „${pendingAction.service.name}” (#${pendingAction.service.id})? Tej operacji nie da się cofnąć.`;
  }, [pendingAction]);

  return (
    <div style={{ padding: 30 }}>
      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>
          <h1 style={beautyPageTitleStyle}>Usługi</h1>
          <p style={beautyMutedTextStyle}>Katalog usług • Łącznie: {totalCount}</p>

          {banner ? (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 12,
                border: '1px solid',
                borderColor: banner.type === 'success' ? '#9ad5b3' : '#f2a6b3',
                backgroundColor: banner.type === 'success' ? '#e9fff1' : '#fff1f3',
                fontWeight: 800,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ wordBreak: 'break-word' }}>{banner.text}</span>
              <button
                style={{ ...beautyButtonSecondaryStyle, padding: '6px 10px' }}
                onClick={() => setBanner(null)}
                disabled={loading}
              >
                ✕
              </button>
            </div>
          ) : null}
        </div>

        <div style={beautyCardBodyStyle}>
          {/* Toolbar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 260 }}>
                <span style={{ fontWeight: 800 }}>Szukaj</span>
                <input
                  style={beautyInputStyle}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nazwa / kategoria…"
                  disabled={loading}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
                <span style={{ fontWeight: 800 }}>Publikacja</span>
                <select
                  style={beautySelectStyle}
                  value={publishFilter}
                  onChange={(e) => setPublishFilter(e.target.value as PublishFilter)}
                  disabled={loading}
                >
                  <option value="all">Wszystkie</option>
                  <option value="published">Opublikowane</option>
                  <option value="unpublished">Wycofane</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
                <span style={{ fontWeight: 800 }}>Kategoria</span>
                <select
                  style={beautySelectStyle}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Wszystkie</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <button
                style={beautyButtonSecondaryStyle}
                onClick={() => void fetchServices(currentPage, pageSize)}
                disabled={loading}
              >
                Odśwież
              </button>
            </div>

            {isManager ? (
              <button
                style={beautyButtonSecondaryStyle}
                onClick={() => {
                  setServiceToEdit(undefined);
                  setModalOpen(true);
                }}
                disabled={loading}
              >
                + Dodaj usługę
              </button>
            ) : null}
          </div>

          {/* Inline confirm */}
          {pendingAction && pendingText ? (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                border: '1px solid #f2a6b3',
                backgroundColor: '#fff1f3',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontWeight: 900, color: '#5a2a35' }}>{pendingText}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button style={beautyButtonSecondaryStyle} onClick={cancelPending} disabled={loading}>
                  Anuluj
                </button>
                <button style={beautyButtonDangerStyle} onClick={() => void confirmPending()} disabled={loading}>
                  Potwierdź
                </button>
              </div>
            </div>
          ) : null}

          {/* Table */}
          <div style={{ marginTop: 14 }}>
            {loading && sortedItems.length === 0 ? (
              <div style={beautyMutedTextStyle}>Ładowanie…</div>
            ) : sortedItems.length === 0 ? (
              <div style={beautyMutedTextStyle}>Brak usług do wyświetlenia.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(233, 30, 99, 0.25)' }}>
                    <th style={{ padding: '10px 8px' }}>ID</th>
                    <th style={{ padding: '10px 8px' }}>Nazwa</th>
                    <th style={{ padding: '10px 8px' }}>Kategoria</th>
                    <th style={{ padding: '10px 8px' }}>Cena</th>
                    <th style={{ padding: '10px 8px' }}>Czas</th>
                    <th style={{ padding: '10px 8px' }}>Status</th>
                    {isManager ? <th style={{ padding: '10px 8px' }}>Akcje</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(233, 30, 99, 0.12)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 900 }}>#{s.id}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 900 }}>{s.name}</div>
                        <div style={beautyMutedTextStyle}>{s.description ? s.description : '—'}</div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>{s.category || '—'}</td>
                      <td style={{ padding: '10px 8px' }}>{formatPricePLN(s.price)}</td>
                      <td style={{ padding: '10px 8px' }}>{formatDurationHHmm(s.duration)}</td>
                      <td style={{ padding: '10px 8px' }}>
                        {s.is_published ? (
                          <span style={pillStyle('ok')}>Opublikowana</span>
                        ) : (
                          <span style={pillStyle('warn')}>Wycofana</span>
                        )}
                      </td>
                      {isManager ? (
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              style={{ ...beautyButtonSecondaryStyle, padding: '8px 12px' }}
                              onClick={() => {
                                setServiceToEdit(s);
                                setModalOpen(true);
                              }}
                              disabled={loading}
                            >
                              Edytuj
                            </button>
                            <button
                              style={{ ...beautyButtonSecondaryStyle, padding: '8px 12px' }}
                              onClick={() => requestTogglePublish(s)}
                              disabled={loading}
                            >
                              {s.is_published ? 'Wycofaj' : 'Opublikuj'}
                            </button>
                            <button
                              style={{ ...beautyButtonDangerStyle, padding: '8px 12px' }}
                              onClick={() => requestDelete(s)}
                              disabled={loading}
                            >
                              Usuń
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 ? (
            <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handlePreviousPage}
                disabled={loading || currentPage === 1}
                style={beautyButtonSecondaryStyle}
              >
                Poprzednia
              </button>
              <span style={{ fontWeight: 800 }}>
                Strona {currentPage} z {totalPages}
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={loading || currentPage === totalPages}
                style={beautyButtonSecondaryStyle}
              >
                Następna
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Modal tylko dla managera */}
      {isManager ? (
        <ServiceFormModal isOpen={modalOpen} onClose={closeModal} onSuccess={onModalSuccess} serviceToEdit={serviceToEdit} />
      ) : null}
    </div>
  );
};
