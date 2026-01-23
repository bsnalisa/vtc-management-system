import { useState, useMemo } from "react";

interface UsePaginationProps<T> {
  data: T[] | undefined;
  defaultPageSize?: number;
}

interface UsePaginationReturn<T> {
  paginatedData: T[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
}

export function usePagination<T>({ 
  data, 
  defaultPageSize = 10 
}: UsePaginationProps<T>): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalItems = data?.length || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedData = useMemo(() => {
    if (!data) return [];
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize]);

  // Reset to page 1 when data changes significantly
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handlePageChange = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  return {
    paginatedData,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    setCurrentPage: handlePageChange,
    setPageSize: handlePageSizeChange,
    goToFirstPage: () => handlePageChange(1),
    goToLastPage: () => handlePageChange(totalPages),
    goToNextPage: () => handlePageChange(currentPage + 1),
    goToPreviousPage: () => handlePageChange(currentPage - 1),
  };
}
