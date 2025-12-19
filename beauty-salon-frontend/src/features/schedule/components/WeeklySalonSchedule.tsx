import type { Employee, ScheduleEntry, TimeOff } from '@/shared/types';

interface Props {
  employees: Employee[];
  schedules: Record<number, ScheduleEntry[]>; // employeeId -> entries
  timeOffs: TimeOff[];
}

const WEEKDAYS = ['Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela'];

export function WeeklySalonSchedule({ employees, schedules, timeOffs }: Props) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 30 }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 900 }}>
        <thead>
          <tr>
            <th style={{ padding: 8, borderBottom: '2px solid #ccc' }}>Dzień</th>
            {employees.map(e => (
              <th key={e.id} style={{ padding: 8, borderBottom: '2px solid #ccc' }}>
                {e.first_name} {e.last_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map(day => (
            <tr key={day}>
              <td style={{ padding: 8, fontWeight: 700 }}>{day}</td>
              {employees.map(emp => {
                const off = timeOffs.find(
                  t => t.employee === emp.id && t.status === 'approved'
                );
                if (off) {
                  return (
                    <td key={emp.id} style={{ padding: 8, background: '#ffe6e6', color: '#900' }}>
                      Urlop
                    </td>
                  );
                }

                const entries = schedules[emp.id]?.filter(s => s.weekday === day);
                if (!entries || entries.length === 0) {
                  return (
                    <td key={emp.id} style={{ padding: 8, color: '#aaa' }}>
                      —
                    </td>
                  );
                }

                return (
                  <td key={emp.id} style={{ padding: 8 }}>
                    {entries.map((e, i) => (
                      <div key={i}>
                        {e.start_time}–{e.end_time}
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
