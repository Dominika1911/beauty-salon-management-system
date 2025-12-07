export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Zgodnie z modelem Client z Django
export interface Client {
  id: number;                   // automatyczny PK
  user: number | null;          // FK do User (id) albo null
  number: string | null;        // numer klienta
  first_name: string;
  last_name: string;
  email: string | null;         // może być null
  phone: string | null;         // może być null

  visits_count: number;         // PositiveIntegerField
  total_spent_amount: string;   // DRF zwykle zwraca Decimal jako string

  marketing_consent: boolean;
  preferred_contact: 'email' | 'sms' | 'phone' | 'none';

  internal_notes: string;

  // z TimestampedModel / SoftDeletableModel
  created_at: string;           // ISO datetime
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeeCreateData {
    email: string;
    password: string; // Wymagane dla nowego konta User
    first_name: string;
    last_name: string;
    phone: string;
    // Number (numer pracownika) i is_active są często zarządzane przez backend,
    // ale dodamy je, jeśli mają być w formularzu:
    number?: string;
    is_active?: boolean;
    skill_ids: number[]; // Lista ID usług, które pracownik potrafi wykonywać
    hired_at?: string; // Data zatrudnienia
}