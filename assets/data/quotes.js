/* ============================================================================
   Quote bank for the footer strip. One is picked at random on every visit,
   and the ↻ button shuffles to another.

   To add one: copy a line, edit it, save, commit, push.
     text   the quote
     by     who said it (leave '' if unknown)
     source where it's from; shown on hover, optional
     mine   true marks it as one of your own favourites
   Only add quotes with a real source; many famous ones online are misattributed.
   ========================================================================== */

window.QUOTES = [
  // --- my favourites ---
  { mine: true, text: 'Life begins at the end of your comfort zone.', by: 'Neale Donald Walsch' },
  { mine: true, text: 'Find what you love and let it kill you.', by: 'Kinky Friedman', source: 'Often misattributed to Charles Bukowski' },
  { mine: true, text: 'Everything happens for a reason.', by: '', source: 'Proverb' },
  { mine: true, text: "There are times you make me wonder whose side you're on.", by: '' },

  // --- Richard Feynman ---
  { text: 'What I cannot create, I do not understand.', by: 'Richard Feynman', source: 'Written on his Caltech blackboard, 1988' },
  { text: 'The first principle is that you must not fool yourself, and you are the easiest person to fool.', by: 'Richard Feynman', source: 'Cargo Cult Science, Caltech commencement, 1974' },
  { text: 'I learned very early the difference between knowing the name of something and knowing something.', by: 'Richard Feynman', source: 'What Do You Care What Other People Think?, 1988' },
  { text: 'For a successful technology, reality must take precedence over public relations, for nature cannot be fooled.', by: 'Richard Feynman', source: 'Rogers Commission Report, Appendix F, 1986' },
  { text: 'Science is the belief in the ignorance of experts.', by: 'Richard Feynman', source: 'What Is Science?, 1966' },
  { text: 'I think I can safely say that nobody understands quantum mechanics.', by: 'Richard Feynman', source: 'The Character of Physical Law, 1965' },
  { text: 'It does not make any difference how beautiful your guess is. If it disagrees with experiment, it is wrong.', by: 'Richard Feynman', source: 'The Character of Physical Law, 1965' },
  { text: 'You have no responsibility to live up to what other people think you ought to accomplish.', by: 'Richard Feynman', source: "Surely You're Joking, Mr. Feynman!, 1985" },
  { text: "Nature isn't classical, dammit, and if you want to make a simulation of nature, you'd better make it quantum mechanical.", by: 'Richard Feynman', source: 'Simulating Physics with Computers, 1981' },

  // --- computing ---
  { text: 'Premature optimization is the root of all evil.', by: 'Donald Knuth', source: 'Structured Programming with go to Statements, 1974' },
  { text: 'Beware of bugs in the above code; I have only proved it correct, not tried it.', by: 'Donald Knuth', source: 'Letter to Peter van Emde Boas, 1977' },
  { text: 'Testing shows the presence, not the absence of bugs.', by: 'Edsger W. Dijkstra', source: 'NATO Software Engineering Conference, 1969' },
  { text: 'Simplicity is prerequisite for reliability.', by: 'Edsger W. Dijkstra', source: 'EWD498, 1975' },
  { text: 'The purpose of computing is insight, not numbers.', by: 'Richard Hamming', source: 'Numerical Methods for Scientists and Engineers, 1962' },
  { text: "A distributed system is one in which the failure of a computer you didn't even know existed can render your own computer unusable.", by: 'Leslie Lamport', source: 'Email, 1987' },
  { text: 'Talk is cheap. Show me the code.', by: 'Linus Torvalds', source: 'Linux kernel mailing list, 2000' },
  { text: 'The best way to predict the future is to invent it.', by: 'Alan Kay', source: 'Xerox PARC, 1971' },

  // --- AI and models ---
  { text: 'We can only see a short distance ahead, but we can see plenty there that needs to be done.', by: 'Alan Turing', source: 'Computing Machinery and Intelligence, 1950' },
  { text: 'The Analytical Engine has no pretensions whatever to originate anything.', by: 'Ada Lovelace', source: 'Notes on the Analytical Engine, Note G, 1843' },
  { text: 'Essentially, all models are wrong, but some are useful.', by: 'George E. P. Box', source: 'Empirical Model-Building and Response Surfaces, 1987' },
  { text: 'General methods that leverage computation are ultimately the most effective, and by a large margin.', by: 'Richard Sutton', source: 'The Bitter Lesson, 2019' },

  // --- science ---
  { text: 'If you wish to make an apple pie from scratch, you must first invent the universe.', by: 'Carl Sagan', source: 'Cosmos, 1980' },
  { text: 'Extraordinary claims require extraordinary evidence.', by: 'Carl Sagan', source: 'Cosmos, 1980' },
  { text: 'If I have seen further it is by standing on the shoulders of giants.', by: 'Isaac Newton', source: 'Letter to Robert Hooke, 1675' },
  { text: 'The important thing is not to stop questioning. Curiosity has its own reason for existing.', by: 'Albert Einstein', source: 'LIFE magazine, 1955' },
];
