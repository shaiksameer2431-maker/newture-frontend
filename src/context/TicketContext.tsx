import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TicketContextProps {
  showTicketForm: boolean;
  openTicketForm: () => void;
  closeTicketForm: () => void;
}

const TicketContext = createContext<TicketContextProps | undefined>(undefined);

export const TicketProvider = ({ children }: { children: ReactNode }) => {
  const [showTicketForm, setShowTicketForm] = useState(false);
  const openTicketForm = () => setShowTicketForm(true);
  const closeTicketForm = () => setShowTicketForm(false);
  return (
    <TicketContext.Provider value={{ showTicketForm, openTicketForm, closeTicketForm }}>
      {children}
    </TicketContext.Provider>
  );
};

export const useTicketContext = () => {
  const ctx = useContext(TicketContext);
  if (!ctx) throw new Error('useTicketContext must be used within TicketProvider');
  return ctx;
};

