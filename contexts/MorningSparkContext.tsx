import React, { createContext, useContext, useState, ReactNode } from 'react';

// ========================================
// TYPE DEFINITIONS
// ========================================

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

interface Goal {
  id: string;
  title: string;
  description?: string;
  status: string;
  progress?: number;
  // 12-week specific
  user_timeline?: {
    cycle_number: number;
    start_date: string;
    end_date: string;
  };
  // 1-year specific
  priority?: number;
  year_target_date?: string;
  // Custom specific
  timeline?: {
    title: string;
    start_date: string;
    end_date: string;
  };
}

interface MorningSparkContextType {
  // Core state
  sparkId: string | null;
  fuelLevel: 1 | 2 | 3 | null;
  
  // Scheduled actions (required steps)
  acceptedEvents: AcceptedEvent[];
  acceptedTasks: AcceptedTask[];
  
  // Optional steps (can be empty arrays)
  goalsInFocus: Goal[];
  activatedDepositIdeas: ActivatedIdea[];
  
  // Setters
  setSparkId: (id: string | null) => void;
  setFuelLevel: (level: 1 | 2 | 3) => void;
  setAcceptedEvents: (events: AcceptedEvent[]) => void;
  setAcceptedTasks: (tasks: AcceptedTask[]) => void;
  setGoalsInFocus: (goals: Goal[]) => void;
  setActivatedDepositIdeas: (ideas: ActivatedIdea[]) => void;
  
  // Helpers
  calculateTargetScore: () => number;
  reset: () => void;
}

// ========================================
// CONTEXT CREATION
// ========================================

const MorningSparkContext = createContext<MorningSparkContextType | undefined>(undefined);

// ========================================
// PROVIDER COMPONENT
// ========================================

export function MorningSparkProvider({ children }: { children: ReactNode }) {
  // Core state
  const [sparkId, setSparkId] = useState<string | null>(null);
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3 | null>(null);
  
  // Required steps
  const [acceptedEvents, setAcceptedEvents] = useState<AcceptedEvent[]>([]);
  const [acceptedTasks, setAcceptedTasks] = useState<AcceptedTask[]>([]);
  
  // Optional steps (empty arrays if skipped)
  const [goalsInFocus, setGoalsInFocus] = useState<Goal[]>([]);
  const [activatedDepositIdeas, setActivatedDepositIdeas] = useState<ActivatedIdea[]>([]);

  /**
   * Calculate the target score for today's commitment
   * This is pre-calculated at commitment time, not actual points earned
   */
  const calculateTargetScore = () => {
    let total = 0;
    
    // Add points from accepted events
    total += acceptedEvents.reduce((sum, event) => sum + (event.points || 3), 0);
    
    // Add points from accepted tasks
    total += acceptedTasks.reduce((sum, task) => sum + (task.points || 3), 0);
    
    // Add points from activated deposit ideas (5 points each)
    total += activatedDepositIdeas.length * 5;
    
    // Add Morning Spark completion bonus (always 10 points)
    total += 10;
    
    return total;
  };

  /**
   * Reset all state to initial values
   * Call this when starting a new Morning Spark or after completion
   */
  const reset = () => {
    setSparkId(null);
    setFuelLevel(null);
    setAcceptedEvents([]);
    setAcceptedTasks([]);
    setGoalsInFocus([]);
    setActivatedDepositIdeas([]);
  };

  return (
    <MorningSparkContext.Provider
      value={{
        // Core state
        sparkId,
        fuelLevel,
        
        // Required steps
        acceptedEvents,
        acceptedTasks,
        
        // Optional steps
        goalsInFocus,
        activatedDepositIdeas,
        
        // Setters
        setSparkId,
        setFuelLevel,
        setAcceptedEvents,
        setAcceptedTasks,
        setGoalsInFocus,
        setActivatedDepositIdeas,
        
        // Helpers
        calculateTargetScore,
        reset,
      }}
    >
      {children}
    </MorningSparkContext.Provider>
  );
}

// ========================================
// HOOK
// ========================================

/**
 * Custom hook to access Morning Spark context
 * Must be used within MorningSparkProvider
 * 
 * @throws Error if used outside of MorningSparkProvider
 */
export const useMorningSpark = () => {
  const context = useContext(MorningSparkContext);
  
  if (!context) {
    throw new Error('useMorningSpark must be used within MorningSparkProvider');
  }
  
  return context;
};

// ========================================
// TYPE EXPORTS
// ========================================

export type { 
  AcceptedEvent, 
  AcceptedTask, 
  ActivatedIdea, 
  Goal,
  MorningSparkContextType 
};