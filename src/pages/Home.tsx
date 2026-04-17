import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Crown, Brain, Calculator, Users, MonitorPlay, Megaphone, BarChart3, HeartHandshake, Users2, ScrollText } from 'lucide-react';
import { useStore } from '../store';
import { StaffCalendar } from '../components/StaffCalendar';
import { DailyCommitments } from '../components/DailyCommitments';
import { SubCircle } from '../components/SubCircle';

// Map of role icons
const roleIcons = {
  'CFO': Calculator,
  'CMO': Megaphone,
  'CTO': MonitorPlay,
  'COO': Users,
  'CSO': BarChart3,
  'CIO': HeartHandshake,
  'CEL': Users2,
  'CHRO': Users,
  'CoS': ScrollText
} as const;

export function Home() {
  const navigate = useNavigate();
  const { advisors, assistant } = useStore();
  const [hoveredAdvisor, setHoveredAdvisor] = useState<typeof advisors[0] | typeof assistant | null>(null);
  const [showSubCircle, setShowSubCircle] = useState(false);
  const numAdvisors = advisors.length;
  const spokeLength = 240; // Length of spokes
  const centerX = 400; // Center X coordinate
  const centerY = 400; // Center Y coordinate

  if (showSubCircle) {
    return <SubCircle onBack={() => setShowSubCircle(false)} />;
  }

  return (
    <div className="space-y-12">
      {/* Round Table Section */}
      <div className="relative w-[800px] h-[800px] mx-auto">
        {/* Spokes */}
        {advisors.map((_, index) => {
          const angle = (index * 2 * Math.PI) / numAdvisors - Math.PI / 2;
          return (
            <div
              key={`spoke-${index}`}
              className="absolute top-1/2 left-1/2 h-[1px] bg-amber-700/20 origin-left"
              style={{
                width: `${spokeLength}px`,
                transform: `rotate(${angle}rad)`,
              }}
            />
          );
        })}

        {/* CEO in center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20">
          <div className="bg-blue-600 rounded-full p-6 shadow-lg hover:shadow-xl transition-shadow border-4 border-white">
            <Crown className="h-12 w-12 text-white" />
          </div>
          <span className="mt-2 font-semibold text-gray-800 text-center">CEO</span>
        </div>

        {/* Advisors */}
        {advisors.map((advisor, index) => {
          const angle = (index * 2 * Math.PI) / numAdvisors - Math.PI / 2;
          const x = spokeLength * Math.cos(angle);
          const y = spokeLength * Math.sin(angle);
          const IconComponent = roleIcons[advisor.role as keyof typeof roleIcons];

          return (
            <Link
              key={advisor.id}
              to={`/advisor/${advisor.id}`}
              className="absolute flex flex-col items-center justify-center"
              style={{
                left: `${centerX + x}px`,
                top: `${centerY + y}px`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div 
                className="group"
                onMouseEnter={() => setHoveredAdvisor(advisor)}
                onMouseLeave={() => setHoveredAdvisor(null)}
              >
                <div className="w-20 h-20 rounded-full border-4 border-amber-100 shadow-lg hover:shadow-xl transition-all hover:scale-105 bg-white flex items-center justify-center">
                  <IconComponent className="h-10 w-10 text-blue-600" />
                </div>
              </div>
              <span className="mt-2 text-sm font-medium text-gray-700 bg-white/90 px-3 py-1 rounded-full shadow-sm text-center">
                {advisor.role}
              </span>
            </Link>
          );
        })}

        {/* Chief of Staff */}
        <div 
          className="absolute right-0 top-1/2 transform translate-x-8 -translate-y-1/2 flex flex-col items-center cursor-pointer"
          onClick={() => setShowSubCircle(true)}
        >
          <div 
            className="group"
            onMouseEnter={() => setHoveredAdvisor(assistant)}
            onMouseLeave={() => setHoveredAdvisor(null)}
          >
            <div className="w-16 h-16 rounded-full border-4 border-gray-100 shadow-lg hover:shadow-xl transition-all hover:scale-105 bg-white flex items-center justify-center">
              <ScrollText className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <span className="mt-2 text-sm font-medium text-gray-700 bg-white/90 px-3 py-1 rounded-full shadow-sm text-center">
            {assistant.role}
          </span>
        </div>

        {/* Shared hover card */}
        {hoveredAdvisor && (
          <div 
            className="bg-white p-6 rounded-xl shadow-xl border border-amber-100"
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -120%)',
              width: '288px',
              zIndex: 50,
              transition: 'opacity 0.3s ease',
            }}
          >
            <h3 className="font-semibold text-gray-900">{hoveredAdvisor.title}</h3>
            <p className="text-sm text-gray-600">{hoveredAdvisor.role}</p>
            <p className="text-sm text-gray-600 mt-2">{hoveredAdvisor.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {hoveredAdvisor.expertise.map((skill) => (
                <span
                  key={skill}
                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Call to Action */}
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-gray-900">Welcome to Your Virtual Round Table</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Consult with your AI advisors to make better business decisions. Each advisor brings unique expertise to help guide your journey.
        </p>
        <button
          onClick={() => navigate('/round-table')}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Brain className="mr-2 h-5 w-5" />
          Start Consulting
        </button>
      </div>

      {/* Staff Calendar Section */}
      <div className="bg-white rounded-xl shadow-lg p-8 mt-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Staff Calendar</h2>
          <button
            onClick={() => {}} // This will be implemented later
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Brain className="mr-2 h-4 w-4" />
            Add Meeting
          </button>
        </div>
        <StaffCalendar />
      </div>

      {/* Today's Commitments (Google Calendar events) */}
      <DailyCommitments />
    </div>
  );
}