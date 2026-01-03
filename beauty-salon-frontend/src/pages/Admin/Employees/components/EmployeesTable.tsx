import React from 'react';
import { Alert, Box, Card, CardContent, LinearProgress } from '@mui/material';
import { DataGrid, type GridColDef, type GridColumnVisibilityModel, type GridSortModel } from '@mui/x-data-grid';
import type { DRFPaginated, Employee } from '@/types';

type Props = {
    rows: Employee[];
    columns: GridColDef<Employee>[];
    loading: boolean;

    employeesData: DRFPaginated<Employee> | null;

    sortModel: GridSortModel;
    setSortModel: (m: GridSortModel) => void;

    page: number;
    setPage: (p: number) => void;

    columnVisibilityModel: GridColumnVisibilityModel;

    emptyInfo: string | null;
};

export default function EmployeesTable(props: Props) {
    const {
        rows,
        columns,
        loading,
        employeesData,
        sortModel,
        setSortModel,
        page,
        setPage,
        columnVisibilityModel,
        emptyInfo,
    } = props;

    return (
        <Card>
            <CardContent>
                {loading ? <LinearProgress sx={{ mb: 2 }} /> : null}

                {emptyInfo ? (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        {emptyInfo}
                    </Alert>
                ) : null}

                <Box sx={{ height: 'calc(100vh - 460px)', minHeight: 420, width: '100%' }}>
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        getRowId={(r) => r.id}
                        disableRowSelectionOnClick
                        sortingMode="server"
                        sortModel={sortModel}
                        onSortModelChange={(model) => setSortModel(model)}
                        paginationMode="server"
                        rowCount={employeesData?.count ?? 0}
                        paginationModel={{ page: page - 1, pageSize: 20 }}
                        onPaginationModelChange={(model) => setPage(model.page + 1)}
                        loading={loading}
                        hideFooter
                        columnVisibilityModel={columnVisibilityModel}
                        sx={{
                            '& .MuiDataGrid-columnHeaders': { borderBottomColor: 'divider' },
                            '& .MuiDataGrid-cell': { alignItems: 'center' },
                        }}
                        localeText={{
                            noRowsLabel: 'Brak danych.',
                            noResultsOverlayLabel: 'Brak wyników.',
                        }}
                    />
                </Box>
            </CardContent>
        </Card>
    );
}
