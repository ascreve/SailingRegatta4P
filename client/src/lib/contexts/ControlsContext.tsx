import React, { createContext, useState, useContext, useEffect } from 'react';

interface ControlsContextProps {
  showControls: boolean;
  setShowControls: React.Dispatch<React.SetStateAction<boolean>>;
  toggleControls: () => void;
}

const ControlsContext = createContext<ControlsContextProps | undefined>(undefined);

export function ControlsProvider({ children }: { children: React.ReactNode }) {
  const [showControls, setShowControls] = useState(false);
  
  const toggleControls = () => {
    setShowControls(prev => !prev);
  };
  
  return (
    <ControlsContext.Provider 
      value={{ 
        showControls, 
        setShowControls,
        toggleControls
      }}
    >
      {children}
    </ControlsContext.Provider>
  );
}

export function useControls() {
  const context = useContext(ControlsContext);
  if (context === undefined) {
    throw new Error('useControls must be used within a ControlsProvider');
  }
  return context;
}