import React, { useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { US_HOLIDAYS, Holiday } from '../../lib/holidays';

interface CalendarManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CalendarManagementModal({ visible, onClose }: CalendarManagementModalProps) {
  const [showHolidaysPage, setShowHolidaysPage] = useState(false);
  const [showSpecialDaysPage, setShowSpecialDaysPage] = useState(false);

  if (!visible) return null;

  const handleClose = () => {
    setShowHolidaysPage(false);
    setShowSpecialDaysPage(false);
    onClose();
  };

  if (showHolidaysPage) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-50 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <HolidaySelectionPage onBack={() => setShowHolidaysPage(false)} />
        </div>
      </div>
    );
  }

  if (showSpecialDaysPage) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-50 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <CustomSpecialDaysPage onBack={() => setShowSpecialDaysPage(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-50 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
          <div className="w-8" />
          <h2 className="text-lg font-semibold text-gray-800">Calendar Management</h2>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white mt-4 px-5 py-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Display Options</h3>

            <button
              className="w-full flex items-center justify-between py-4 border-b border-gray-100"
              onClick={() => setShowHolidaysPage(true)}
            >
              <div className="text-left">
                <p className="text-base font-medium text-gray-800">Holidays</p>
                <p className="text-sm text-gray-500">Choose which holidays to display on your calendar</p>
              </div>
              <ChevronRight size={18} className="text-gray-400 flex-shrink-0 ml-3" />
            </button>

            <button
              className="w-full flex items-center justify-between py-4"
              onClick={() => setShowSpecialDaysPage(true)}
            >
              <div className="text-left">
                <p className="text-base font-medium text-gray-800">Custom Special Days</p>
                <p className="text-sm text-gray-500">Add your own special days and celebrations</p>
              </div>
              <ChevronRight size={18} className="text-gray-400 flex-shrink-0 ml-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HolidaySelectionPage({ onBack }: { onBack: () => void }) {
  const [selectedHolidays, setSelectedHolidays] = useState<string[]>(
    US_HOLIDAYS.filter(h => h.enabled).map(h => h.id)
  );

  const toggleHoliday = (holidayId: string) => {
    if (selectedHolidays.includes(holidayId)) {
      setSelectedHolidays(selectedHolidays.filter(id => id !== holidayId));
    } else {
      setSelectedHolidays([...selectedHolidays, holidayId]);
    }
  };

  const federalHolidays = US_HOLIDAYS.filter(h => h.category === 'federal');
  const religiousHolidays = US_HOLIDAYS.filter(h => h.category === 'religious');
  const observances = US_HOLIDAYS.filter(h => h.category === 'observance');

  const renderHolidayItem = (holiday: Holiday) => {
    const isSelected = selectedHolidays.includes(holiday.id);

    return (
      <button
        key={holiday.id}
        className="w-full flex items-center justify-between py-3 border-b border-gray-100"
        onClick={() => toggleHoliday(holiday.id)}
      >
        <div className="flex items-center">
          <span
            className="w-3 h-3 rounded-full mr-3"
            style={{ backgroundColor: holiday.color }}
          />
          <span className="text-sm text-gray-800">{holiday.name}</span>
        </div>
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
            isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
          }`}
        >
          {isSelected && <span className="text-white text-xs font-bold">&#10003;</span>}
        </div>
      </button>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <button onClick={onBack} className="text-blue-600 text-sm">
          &larr; Back
        </button>
        <h2 className="text-lg font-semibold text-gray-800">Select Holidays</h2>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white mt-4 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Federal Holidays</h3>
          {federalHolidays.map(renderHolidayItem)}
        </div>

        <div className="bg-white mt-4 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Religious Holidays</h3>
          {religiousHolidays.map(renderHolidayItem)}
        </div>

        <div className="bg-white mt-4 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Observances</h3>
          {observances.map(renderHolidayItem)}
        </div>

        <div className="px-5 py-6">
          <button className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </>
  );
}

function CustomSpecialDaysPage({ onBack }: { onBack: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <button onClick={onBack} className="text-blue-600 text-sm">
          &larr; Back
        </button>
        <h2 className="text-lg font-semibold text-gray-800">Custom Special Days</h2>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white mt-4 mx-5 p-8 rounded-lg text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Coming Soon</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-2">
            Add your own custom special days like birthdays, anniversaries, and personal celebrations to your calendar.
          </p>
          <p className="text-sm text-gray-500 leading-relaxed">
            This feature is currently under development.
          </p>
        </div>
      </div>
    </>
  );
}
