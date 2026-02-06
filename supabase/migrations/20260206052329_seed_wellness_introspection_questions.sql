/*
  # Seed wellness zone introspection questions (vision + mission)

  1. New Data
    - Adds 3 vision-strategy introspection questions per wellness zone (24 total)
    - Adds 3 mission-strategy introspection questions per wellness zone (24 total)
    - All questions use wz_type = 'wz' and the appropriate wellness_zone value
    - question_type = 'introspection' to distinguish from existing 'one_thing_focus' questions

  2. Important Notes
    - No existing questions are modified or deleted
    - These enable the "Deeper Introspection" feature in the Wellness Vision Board
    - Matches the pattern used by role-based vision/mission introspection
*/

INSERT INTO "0008-ap-power-questions" (question_text, question_context, strategy_type, wz_type, wellness_zone, question_type, display_order, is_active, bottom_angle, top_angle)
VALUES
-- Physical - Vision
('What does peak physical vitality look like for you in your ideal life?', 'Think about energy levels, movement, strength, and how your body feels day to day.', 'vision', 'wz', 'physical', 'introspection', 1, true, 180, 180),
('If you had no physical limitations, what would you be doing with your body every day?', 'Imagine your best physical self — what activities, habits, and routines define that version of you?', 'vision', 'wz', 'physical', 'introspection', 2, true, 180, 180),
('How would your life change if you consistently showed up for your physical health?', 'Consider the ripple effects on your energy, confidence, relationships, and productivity.', 'vision', 'wz', 'physical', 'introspection', 3, true, 180, 180),

-- Physical - Mission
('What is your core commitment to your physical well-being?', 'Define the non-negotiable standard you hold for how you treat your body.', 'mission', 'wz', 'physical', 'introspection', 1, true, 180, 180),
('What daily physical habit would have the greatest compound effect over the next year?', 'Think about small, sustainable actions that build momentum.', 'mission', 'wz', 'physical', 'introspection', 2, true, 180, 180),
('What physical limitation or pattern are you ready to overcome?', 'Identify the one barrier that, if removed, would unlock the most progress.', 'mission', 'wz', 'physical', 'introspection', 3, true, 180, 180),

-- Emotional - Vision
('What does emotional flourishing look like for you?', 'Imagine feeling deeply at peace, resilient, and emotionally present in your relationships.', 'vision', 'wz', 'emotional', 'introspection', 1, true, 180, 180),
('How would you describe your ideal emotional state on a typical day?', 'Think about the feelings, mindset, and emotional energy you want to carry.', 'vision', 'wz', 'emotional', 'introspection', 2, true, 180, 180),
('What would change in your life if you mastered your emotional responses?', 'Consider how emotional mastery would affect your decisions, relationships, and inner peace.', 'vision', 'wz', 'emotional', 'introspection', 3, true, 180, 180),

-- Emotional - Mission
('What is your guiding principle for emotional well-being?', 'Define the standard you want to hold for how you process and express emotions.', 'mission', 'wz', 'emotional', 'introspection', 1, true, 180, 180),
('What emotional pattern do you want to transform this season?', 'Identify a recurring emotional reaction that no longer serves you.', 'mission', 'wz', 'emotional', 'introspection', 2, true, 180, 180),
('How can you create more emotional safety for yourself and those around you?', 'Think about boundaries, communication, and self-care practices.', 'mission', 'wz', 'emotional', 'introspection', 3, true, 180, 180),

-- Intellectual - Vision
('What does a thriving intellectual life look like for you?', 'Imagine the ideas, learning, and mental stimulation that energize you most.', 'vision', 'wz', 'intellectual', 'introspection', 1, true, 180, 180),
('If you could master any skill or subject, what would it be and why?', 'Think about what knowledge would most transform your life or career.', 'vision', 'wz', 'intellectual', 'introspection', 2, true, 180, 180),
('How do you want to be growing intellectually five years from now?', 'Consider the trajectory of your learning, creativity, and mental sharpness.', 'vision', 'wz', 'intellectual', 'introspection', 3, true, 180, 180),

-- Intellectual - Mission
('What is your commitment to continuous learning and growth?', 'Define how you will consistently invest in your intellectual development.', 'mission', 'wz', 'intellectual', 'introspection', 1, true, 180, 180),
('What intellectual habit would compound into extraordinary results over time?', 'Think about reading, writing, problem-solving, or creative practices.', 'mission', 'wz', 'intellectual', 'introspection', 2, true, 180, 180),
('What mental comfort zone are you ready to push beyond?', 'Identify where complacency has settled in your thinking or learning.', 'mission', 'wz', 'intellectual', 'introspection', 3, true, 180, 180),

-- Social - Vision
('What do your ideal relationships and social connections look like?', 'Imagine the quality, depth, and frequency of your most important connections.', 'vision', 'wz', 'social', 'introspection', 1, true, 180, 180),
('How do you want people to experience you in social settings?', 'Think about the energy, presence, and impact you bring to your relationships.', 'vision', 'wz', 'social', 'introspection', 2, true, 180, 180),
('What would your social life look like if you invested in it intentionally?', 'Consider the friendships, community, and belonging you desire.', 'vision', 'wz', 'social', 'introspection', 3, true, 180, 180),

-- Social - Mission
('What is your commitment to nurturing meaningful relationships?', 'Define the standard you hold for how you show up for the people who matter most.', 'mission', 'wz', 'social', 'introspection', 1, true, 180, 180),
('Which relationship deserves more of your intentional attention right now?', 'Think about who would benefit most from your presence and investment.', 'mission', 'wz', 'social', 'introspection', 2, true, 180, 180),
('What social habit or pattern is holding you back from deeper connection?', 'Identify barriers like avoidance, over-commitment, or surface-level engagement.', 'mission', 'wz', 'social', 'introspection', 3, true, 180, 180),

-- Spiritual - Vision
('What does spiritual fulfillment look like in your life?', 'Imagine a deep sense of purpose, meaning, and connection to something greater.', 'vision', 'wz', 'spiritual', 'introspection', 1, true, 180, 180),
('How do you want your spiritual practice to shape your daily experience?', 'Think about the peace, clarity, and grounding your practice brings.', 'vision', 'wz', 'spiritual', 'introspection', 2, true, 180, 180),
('What would your life feel like if you were fully aligned with your deepest values?', 'Consider the harmony between your actions, beliefs, and inner truth.', 'vision', 'wz', 'spiritual', 'introspection', 3, true, 180, 180),

-- Spiritual - Mission
('What is your core spiritual commitment or practice?', 'Define the non-negotiable spiritual habit that anchors your life.', 'mission', 'wz', 'spiritual', 'introspection', 1, true, 180, 180),
('What spiritual question or theme are you exploring right now?', 'Think about the deeper questions that are calling for your attention.', 'mission', 'wz', 'spiritual', 'introspection', 2, true, 180, 180),
('How can you create more space for reflection and stillness in your week?', 'Consider what you might release or restructure to make room for the sacred.', 'mission', 'wz', 'spiritual', 'introspection', 3, true, 180, 180),

-- Financial - Vision
('What does financial freedom and security look like for you?', 'Imagine the lifestyle, opportunities, and peace of mind that come with financial wellness.', 'vision', 'wz', 'financial', 'introspection', 1, true, 180, 180),
('How would your life change if money were no longer a source of stress?', 'Consider the decisions, experiences, and generosity that would become possible.', 'vision', 'wz', 'financial', 'introspection', 2, true, 180, 180),
('What financial legacy do you want to create?', 'Think about the long-term impact of your financial choices on yourself and others.', 'vision', 'wz', 'financial', 'introspection', 3, true, 180, 180),

-- Financial - Mission
('What is your core financial principle or commitment?', 'Define the guiding rule that shapes your money decisions.', 'mission', 'wz', 'financial', 'introspection', 1, true, 180, 180),
('What is the one financial habit that would have the greatest impact on your future?', 'Think about saving, investing, budgeting, or earning patterns.', 'mission', 'wz', 'financial', 'introspection', 2, true, 180, 180),
('What financial fear or pattern are you ready to confront?', 'Identify the money mindset or behavior that is limiting your progress.', 'mission', 'wz', 'financial', 'introspection', 3, true, 180, 180),

-- Recreational - Vision
('What does a rich, playful, and restorative life look like for you?', 'Imagine having ample time and energy for the activities that recharge you.', 'vision', 'wz', 'recreational', 'introspection', 1, true, 180, 180),
('What hobbies or activities bring you the deepest sense of joy and renewal?', 'Think about what you would do if you had an extra day each week just for yourself.', 'vision', 'wz', 'recreational', 'introspection', 2, true, 180, 180),
('How would your overall well-being improve if you prioritized play and rest?', 'Consider the impact on your creativity, relationships, and resilience.', 'vision', 'wz', 'recreational', 'introspection', 3, true, 180, 180),

-- Recreational - Mission
('What is your commitment to rest, play, and renewal?', 'Define how you will protect time for activities that restore your energy.', 'mission', 'wz', 'recreational', 'introspection', 1, true, 180, 180),
('What recreational activity would you like to make a consistent part of your life?', 'Think about the one hobby or pastime that deserves more of your time.', 'mission', 'wz', 'recreational', 'introspection', 2, true, 180, 180),
('What is preventing you from making time for fun and restoration?', 'Identify the beliefs, habits, or obligations that crowd out your leisure.', 'mission', 'wz', 'recreational', 'introspection', 3, true, 180, 180),

-- Community - Vision
('What does meaningful community involvement look like for you?', 'Imagine the impact, connection, and belonging that comes from active community engagement.', 'vision', 'wz', 'community', 'introspection', 1, true, 180, 180),
('How do you want to contribute to the world beyond your immediate circle?', 'Think about the causes, organizations, or movements that matter to you.', 'vision', 'wz', 'community', 'introspection', 2, true, 180, 180),
('What would your community life look like if you invested in it intentionally?', 'Consider the relationships, service, and impact you could create.', 'vision', 'wz', 'community', 'introspection', 3, true, 180, 180),

-- Community - Mission
('What is your commitment to serving your community?', 'Define how you will consistently show up for the people and causes around you.', 'mission', 'wz', 'community', 'introspection', 1, true, 180, 180),
('What community need aligns most closely with your skills and passions?', 'Think about where your unique strengths could make the biggest difference.', 'mission', 'wz', 'community', 'introspection', 2, true, 180, 180),
('What is one step you can take this season to deepen your community roots?', 'Identify a concrete action — volunteering, joining, connecting, or contributing.', 'mission', 'wz', 'community', 'introspection', 3, true, 180, 180);
