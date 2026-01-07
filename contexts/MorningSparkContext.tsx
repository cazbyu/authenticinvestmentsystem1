import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AcceptedEvent {
  id: string;
  title: string;
  points: number;
}

interface AcceptedTask {
  id: string;
  title: string;
  points: number;
}

interface ActivatedIdea {
  id: string;
  title: string;
}

interface MorningSparkContextType {
  fuelLevel: 1 | 2 | 3 | null;
  acceptedEvents: AcceptedEvent[];
  acceptedTasks: AcceptedTask[];
  activatedDepositIdeas: ActivatedIdea[];
  setFuelLevel: (level: 1 | 2 | 3) => void;
  setAcceptedEvents: (events: AcceptedEvent[]) => void;
  setAcceptedTasks: (tasks: AcceptedTask[]) => void;
  setActivatedDepositIdeas: (ideas: ActivatedIdea[]) => void;
  calculateTargetScore: () => number;
  reset: () => void;
}

const MorningSparkContext = createContext<MorningSparkContextType | undefined>(undefined);

export function MorningSparkProvider({ children }: { children: ReactNode }) {
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3 | null>(null);
  const [acceptedEvents, setAcceptedEvents] = useState<AcceptedEvent[]>([]);
  const [acceptedTasks, setAcceptedTasks] = useState<AcceptedTask[]>([]);
  const [activatedDepositIdeas, setActivatedIdea] = useState<ActivatedIdea[]>([]);

  const calculateTargetScore = () => {
    let total = 0;

    total += acceptedEvents.reduce((sum, e) => sum + (e.points || 3), 0);
    total += acceptedTasks.reduce((sum, t) => sum + (t.points || 3), 0);
    total += activatedDepositIdeas.length * 5;
    total += 10;

    return total;
  };

  const reset = () => {
    setFuelLevel(null);
    setAcceptedEvents([]);
    setAcceptedTasks([]);
    setActivatedIdea([]);
  };

  return (
    <MorningSparkContext.Provider
      value={{
        fuelLevel,
        acceptedEvents,
        acceptedTasks,
        activatedDepositIdeas,
        setFuelLevel,
        setAcceptedEvents,
        setAcceptedTasks,
        setActivatedDepositIdeas: setActivatedIdea,
        calculateTargetScore,
        reset,
      }}
    >
      {children}
    </MorningSparkContext.Provider>
  );
}

export const useMorningSpark = () => {
  const context = useContext(MorningSparkContext);
  if (!context) {
    throw new Error('useMorningSpark must be used within MorningSparkProvider');
  }
  return context;
};
