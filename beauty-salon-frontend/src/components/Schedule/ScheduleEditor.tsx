import React, { useMemo, useState, useEffect, type ReactElement } from 'react';
import type { ScheduleEntry, Weekday } from '@/types';
import { scheduleAPI } from '@/api/schedule.ts';
import { useNotification } from "@/components/Notification";


const WEEKDAYS: Weekday[] = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
const WEEKDAY_ORDER = new Map<Weekday, number>(WEEKDAYS.map((d, i) => [d, i]));

const POLISH_TO_ENGLISH_MAP = new Map<Weekday, string>([
  ['Poniedziałek', 'Monday'],
  ['Wtorek', 'Tuesday'],
  ['Środa', 'Wednesday'],
  ['Czwartek', 'Thursday'],
  ['Piątek', 'Friday'],
  ['Sobota', 'Saturday'],
  ['Niedziela', 'Sunday'],
]);

const ENGLISH_TO_POLISH_MAP = new Map<string, Weekday>([
  ['Monday', 'Poniedziałek'],
  ['Tuesday', 'Wtorek'],
  ['Wednesday', 'Środa'],
  ['Thursday', 'Czwartek'],
  ['Friday', 'Piątek'],
  ['Saturday', 'Sobota'],
  ['Sunday', 'Niedziela'],
]);

interface ScheduleEditorProps {
  employeeId: number;
  initialSchedule: ScheduleEntry[];
  onSuccess: () => void;
  isManager: boolean;
}

const ensureLocalIds = (entries: ScheduleEntry[]): ScheduleEntry[] => {
  return entries.map((e, idx) => ({
    ...e,
    id: (e.id ?? Number(`${idx}${Math.floor(Math.random() * 100000)}`)) as any,
  }));
};

const normalizeTime = (t: string) => (t.length === 5 ? `${t}:00` : t);

const DEFAULT_ENTRY: Omit<ScheduleEntry, 'weekday'> = {
  start_time: '09:00',
  end_time: '17:00',
};

export const ScheduleEditor: React.FC<ScheduleEditorProps> = ({
  employeeId,
  initialSchedule,
  onSuccess,
  isManager,
}): ReactElement => {
  const { showNotification } = useNotification();

  const [schedule, setSchedule] = useState<ScheduleEntry[]>(() => ensureLocalIds(initialSchedule));
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    const validSchedule = initialSchedule.filter((entry) => entry.weekday && entry.start_time && entry.end_time);
    if (validSchedule.length === 0) {
      console.warn('⚠️ Brak poprawnych wpisów grafiku');
    }

    setSchedule(ensureLocalIds(validSchedule));
    setInlineError(null);
  }, [employeeId, initialSchedule]);

  const sortedSchedule = useMemo(() => {
    return [...schedule].sort(
      (a, b) => (WEEKDAY_ORDER.get(a.weekday) ?? 999) - (WEEKDAY_ORDER.get(b.weekday) ?? 999)
    );
  }, [schedule]);

  const usedDays = useMemo(() => new Set(schedule.map((s) => s.weekday)), [schedule]);
  const remainingDays = useMemo(() => WEEKDAYS.filter((d) => !usedDays.has(d)), [usedDays]);

  const validate = (): string | null => {
    const seen = new Set<Weekday>();
    for (const entry of schedule) {
      if (seen.has(entry.weekday)) return `Dzień "${entry.weekday}" występuje więcej niż raz.`;
      seen.add(entry.weekday);
    }

    for (const entry of schedule) {
      const s = entry.start_time?.substring(0, 5);
      const e = entry.end_time?.substring(0, 5);
      if (!s || !e) return `Uzupełnij godziny dla: ${entry.weekday}.`;
      if (s >= e) return `Godzina startu (${entry.weekday}) musi być wcześniejsza niż koniec.`;
    }

    return null;
  };

  const addEntry = () => {
    if (!remainingDays.length) return;

    const weekday = remainingDays[0];
    setSchedule((prev) => [
      ...prev,
      {
        id: Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`) as any,
        weekday,
        ...DEFAULT_ENTRY,
      },
    ]);
  };

  const removeEntry = (id: number) => {
    setSchedule((prev) => prev.filter((e) => e.id !== id));
  };

  const handleEntryChange = (id: number, field: 'start_time' | 'end_time', value: string) => {
    setSchedule((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);

    const v = validate();
    if (v) {
      setInlineError(v);
      showNotification(v, 'error');
      return;
    }

    setLoading(true);

    try {
      const availability_periods = schedule.map((entry) => {
        const englishDay = POLISH_TO_ENGLISH_MAP.get(entry.weekday);
        if (!englishDay) throw new Error(`Nieznany dzień tygodnia: ${entry.weekday}`);

        return {
          weekday: englishDay,
          start_time: normalizeTime(entry.start_time.substring(0, 5)),
          end_time: normalizeTime(entry.end_time.substring(0, 5)),
        };
      });

      // ✅ Backend przyjmuje weekday jako string (EN), a typ w FE ma Weekday (PL) – więc castujemy payload,
      // żeby TS nie blokował builda (endpointów nie zmieniamy).
      const res = await scheduleAPI.updateEmployeeSchedule(employeeId, {
        status: 'active',
        breaks: [],
        availability_periods: availability_periods as any,
      });

      const savedPeriods = (res.data?.availability_periods ?? []) as Array<{
        weekday: string;
        start_time: string;
        end_time: string;
      }>;

      const savedSchedule: ScheduleEntry[] = savedPeriods.map((p, idx) => ({
        id: Number(`${Date.now()}${idx}`) as any,
        weekday: ENGLISH_TO_POLISH_MAP.get(p.weekday) ?? (p.weekday as any),
        start_time: (p.start_time ?? '').substring(0, 5),
        end_time: (p.end_time ?? '').substring(0, 5),
      }));

      if (savedSchedule.length > 0) {
        setSchedule(savedSchedule);
      }

      showNotification('Harmonogram pracy został zapisany.', 'success');
      onSuccess();
    } catch (error: any) {
      console.error('Błąd zapisu harmonogramu:', error?.response?.data ?? error);
      const msg = error?.response?.data ? JSON.stringify(error.response.data) : 'Nie udało się zapisać harmonogramu.';
      setInlineError(msg);
      showNotification('Nie udało się zapisać harmonogramu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="scheduleForm" onSubmit={handleSubmit}>
      <div className="scheduleCard">
        <div className="scheduleHeader">
          <h3 className="scheduleTitle">Grafik pracy</h3>
        </div>

        {inlineError && <div className="inlineError">{inlineError}</div>}

        <div className="scheduleList">
          {sortedSchedule.length === 0 ? (
            <div className="emptyState">Brak wpisów grafiku.</div>
          ) : (
            sortedSchedule.map((entry) => (
              <div key={String(entry.id)} className="scheduleRow">
                <div className="weekday">{entry.weekday}</div>

                <input
                  type="time"
                  value={(entry.start_time ?? '').substring(0, 5)}
                  onChange={(e) => handleEntryChange(entry.id!, 'start_time', e.target.value)}
                  disabled={!isManager}
                  required
                />

                <input
                  type="time"
                  value={(entry.end_time ?? '').substring(0, 5)}
                  onChange={(e) => handleEntryChange(entry.id!, 'end_time', e.target.value)}
                  disabled={!isManager}
                  required
                />

                {isManager ? (
                  <button type="button" className="btnDangerOutline" onClick={() => removeEntry(entry.id!)}>
                    Usuń
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))
          )}
        </div>

        <div className="scheduleActions">
          {isManager && (
            <>
              <button
                type="button"
                className="btnBeauty btnOutline"
                onClick={addEntry}
                disabled={loading || remainingDays.length === 0}
              >
                + Dodaj
              </button>

              <button type="submit" className="btnBeauty btnSuccess" disabled={loading || schedule.length === 0}>
                {loading ? 'Zapisywanie…' : 'Zapisz'}
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );
};
