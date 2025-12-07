import { useState, useMemo } from 'react';

// Interfejs dla zwracanych wartości hooka
interface PaginationControls {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  setTotalCount: React.Dispatch<React.SetStateAction<number>>;
  handlePreviousPage: () => void;
  handleNextPage: () => void;
}

/**
 * Hook do zarządzania stanem i logiką paginacji DRF.
 * @param initialPageSize Domyślna liczba elementów na stronie.
 */
export const usePagination = (initialPageSize: number = 25): PaginationControls => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const pageSize = initialPageSize;

  // Obliczanie łącznej liczby stron
  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize]);

  // Obsługa nawigacji wstecz
  const handlePreviousPage = (): void => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Obsługa nawigacji w przód
  const handleNextPage = (): void => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return {
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    setCurrentPage,
    setTotalCount,
    handlePreviousPage,
    handleNextPage,
  };
};