-- Default SMB-style category and metric set (matches the HTML prototype
-- exactly, including ordering — the legacy backup importer relies on this).

INSERT INTO categories (id, key, name, description, icon, sort_order, active) VALUES
  (1, 'playbook',    'Playbook Adherence',            'How closely you followed your pre-defined trading playbook and setups today.',                       'book-open',    1, 1),
  (2, 'quality',     'Trade Quality',                 'Quality of your entries, stops, targets, and trade management decisions.',                          'target',       2, 1),
  (3, 'opportunity', 'Opportunity Capture',           'Did you identify and act on the best setups? Were you sized correctly relative to conviction?',     'zap',          3, 1),
  (4, 'risk',        'Risk Discipline',               'Adherence to max loss rules, position sizing limits, and risk/reward discipline.',                  'shield',       4, 1),
  (5, 'emotional',   'Emotional & Mental Stability',  'Your mental state, emotional control, and freedom from FOMO, tilt, and overconfidence.',            'brain',        5, 1),
  (6, 'execution',   'Execution Discipline',          'Mechanical execution quality: correct order types, sizes, and pre-session preparation.',            'check-circle', 6, 1);

INSERT INTO metrics (category_id, label, sort_order, active) VALUES
  (1, 'Stuck to my defined setups only',              1, 1),
  (1, 'Avoided trades outside my playbook',           2, 1),
  (1, 'Pre-planned entries were respected',           3, 1),
  (1, 'Did not chase entries',                        4, 1),

  (2, 'Entry quality (timing, confirmation)',         1, 1),
  (2, 'Stop placement (logical, not arbitrary)',      2, 1),
  (2, 'Target identification (clear profit objective)', 3, 1),
  (2, 'Trade management (adds, trims, stops)',        4, 1),
  (2, 'Avoided overtrading',                          5, 1),

  (3, 'Identified best setups of the session',        1, 1),
  (3, 'Acted on high-conviction ideas',               2, 1),
  (3, 'Did not miss A-setups due to hesitation',      3, 1),
  (3, 'Sized appropriately relative to conviction',   4, 1),

  (4, 'Max loss rule respected',                      1, 1),
  (4, 'Position sizing within plan',                  2, 1),
  (4, 'No revenge trading',                           3, 1),
  (4, 'Stopped trading after daily loss limit hit',   4, 1),
  (4, 'Risk/Reward was favorable before entry',       5, 1),

  (5, 'Emotional state entering the session',         1, 1),
  (5, 'Remained calm during drawdowns',               2, 1),
  (5, 'No FOMO-driven decisions',                     3, 1),
  (5, 'No tilt/frustration trading after losses',     4, 1),
  (5, 'Confidence level without overconfidence',      5, 1),

  (6, 'Orders placed correctly (type, size)',         1, 1),
  (6, 'No fat-finger errors or panic exits',          2, 1),
  (6, 'Used hotkeys/tools as planned',                3, 1),
  (6, 'Reviewed levels/plan before trading',          4, 1);
