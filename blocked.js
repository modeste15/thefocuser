const IMAGES = [
  'images/1.png',
  'images/2.png',
  'images/3.png',
  'images/4.png',
  'images/5.png',
  'images/6.png',
  'images/7.png',
];

const QUOTES = [
  { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey" },
  { text: "Deep work is the ability to focus without distraction on a cognitively demanding task.", author: "Cal Newport" },
  { text: "Focus is a matter of deciding what things you're not going to do.", author: "John Carmack" },
  { text: "Wherever you are, be all there.", author: "Jim Elliot" },
  { text: "The successful warrior is the average man with laser-like focus.", author: "Bruce Lee" },
  { text: "You will never reach your destination if you stop and throw stones at every dog that barks.", author: "Winston Churchill" },
];

const params = new URLSearchParams(location.search);
const siteName = params.get('site') || 'bro';

document.getElementById('site-name').textContent = siteName;

// Increment the blocked counter for this site
chrome.runtime.sendMessage({ action: 'countVisit', site: siteName });
document.getElementById('illus').src = IMAGES[Math.floor(Math.random() * IMAGES.length)];

const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
document.getElementById('quote-text').textContent = `"${q.text}"`;
