import React from 'react';
import { Alert, Button, Stack } from '@mui/material';
import type { EmployeePublic } from '@/api/employees';

interface Props {
    employees: EmployeePublic[];
    selectedEmployeeId: number | null;
    onPickEmployee: (e: EmployeePublic) => void;
    onUserInteraction: () => void;
}

export const EmployeeStep: React.FC<Props> = ({
    employees,
    selectedEmployeeId,
    onPickEmployee,
    onUserInteraction,
}) => {
    return (
        <Stack spacing={2} data-testid="employee-step">
            {employees.length === 0 ? (
                <Alert severity="info">Brak dostępnych specjalistów.</Alert>
            ) : (
                <Stack spacing={2} data-testid="employee-list">
                    {employees.map((e) => (
                        <Button
                            key={e.id}
                            data-testid={`employee-btn-${e.id}`}
                            variant={selectedEmployeeId === e.id ? 'contained' : 'outlined'}
                            onClick={() => {
                                onUserInteraction();
                                onPickEmployee(e);
                            }}
                        >
                            {e.full_name}
                        </Button>
                    ))}
                </Stack>
            )}
        </Stack>
    );
};
