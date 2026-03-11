import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import MonthlyCardsView from '../reflections/MonthlyCardsView';
import MonthlyIndexView from '../reflections/MonthlyIndexView';
import DailyViewModal from '../reflections/DailyViewModal';

type ViewState = 'monthlyCards' | 'monthlyIndex' | 'dailyView';

export default function JournalHistoryView() {
  const { colors } = useTheme();
  const [currentView, setCurrentView] = useState<ViewState>('monthlyCards');
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number; monthYear: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleMonthPress = (year: number, month: number, monthYear: string) => {
    setSelectedMonth({ year, month, monthYear });
    setCurrentView('monthlyIndex');
  };

  const handleDatePress = (date: string) => {
    const normalizedDate = date.split('T')[0];
    setSelectedDate(normalizedDate);
    setCurrentView('dailyView');
  };

  const handleBackToMonthlyCards = () => {
    setSelectedMonth(null);
    setCurrentView('monthlyCards');
  };

  const handleCloseDailyView = () => {
    setSelectedDate(null);
    setCurrentView('monthlyIndex');
  };

  const handleNotePress = (item: any) => {
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {currentView === 'monthlyCards' && (
        <MonthlyCardsView onMonthPress={handleMonthPress} />
      )}

      {currentView === 'monthlyIndex' && selectedMonth && (
        <MonthlyIndexView
          year={selectedMonth.year}
          month={selectedMonth.month}
          monthYear={selectedMonth.monthYear}
          onBackPress={handleBackToMonthlyCards}
          onDatePress={handleDatePress}
        />
      )}

      {currentView === 'dailyView' && selectedDate && (
        <DailyViewModal
          visible={true}
          selectedDate={selectedDate}
          onClose={handleCloseDailyView}
          onNotePress={handleNotePress}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
