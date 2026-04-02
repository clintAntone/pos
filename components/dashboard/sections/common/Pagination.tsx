import React from 'react';
import { UI_THEME } from '../../../../constants/ui_designs';
import { playSound } from '../../../../lib/audio';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage
}) => {
  if (totalPages <= 1) return null;

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    playSound('click');
    onPageChange(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-white border border-slate-100 rounded-2xl shadow-sm no-print overflow-hidden">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sm:text-left">
        Showing <span className="text-slate-900">{startItem}</span> to <span className="text-slate-900">{endItem}</span> of <span className="text-slate-900">{totalItems}</span> entries
      </div>
      
      <div className="flex items-center justify-center gap-1 sm:gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar py-0.5">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`p-1.5 rounded-lg border transition-all shrink-0 ${
            currentPage === 1 
              ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' 
              : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-500 hover:text-emerald-600 active:scale-90'
          }`}
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            // Show pages around current page
            let pageNum = currentPage;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-[9px] sm:text-[10px] font-black transition-all shrink-0 ${
                  currentPage === pageNum
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`p-1.5 rounded-lg border transition-all shrink-0 ${
            currentPage === totalPages 
              ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' 
              : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-500 hover:text-emerald-600 active:scale-90'
          }`}
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};
