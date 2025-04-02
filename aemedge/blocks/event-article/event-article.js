// Define the event data directly in the JavaScript file
const eventData = {
  events: [
    {
      feedId: 'feed123',
      title: 'Economic Calendar Event - Q1 2024',
      description: 'The Federal Reserve announced today that it will maintain its current monetary policy stance.',
      publisheddate: '2024-01-14T18:19:00',
      category: 'Economic Events',
    },
    {
      feedId: 'feed456',
      title: 'ECB Interest Rate Decision',
      description: 'The European Central Bank has decided to increase interest rates by 25 basis points in response to persistent inflation pressures.',
      publisheddate: '2024-01-15T13:45:00',
      category: 'Economic Events',
    },
    {
      feedId: 'feed789',
      title: 'US Employment Report',
      description: 'Non-farm payrolls increased by 223,000 in December, exceeding market expectations of 200,000 jobs.',
      publisheddate: '2024-01-16T08:30:00',
      category: 'Economic Events',
    },
    {
      feedId: 'feed101',
      title: 'Bank of Japan Policy Meeting',
      description: 'The Bank of Japan maintains negative interest rates while adjusting yield curve control parameters.',
      publisheddate: '2024-01-17T02:00:00',
      category: 'Economic Events',
    },
    {
      feedId: 'feed202',
      title: 'UK Inflation Data Release',
      description: 'British consumer price inflation unexpectedly slowed to 3.9% in November from 4.6% in October.',
      publisheddate: '2024-01-17T09:30:00',
      category: 'Economic Events',
    },
  ],
};

function getFeedId() {
  const url = window.location.pathname;
  const segments = url.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  return lastSegment === 'econoday' ? '' : lastSegment || null;
}

async function getData() {
  const eventId = getFeedId();

  if (eventId === null || eventId === '') {
    return { status: 404 };
  }

  // Find the matching event from the imported JSON
  const event = eventData.events.find((event) => event.feedId === eventId);
  return event || { status: 404 };
}

export default async function decorate(block) {
  const data = await getData();

  if (!data || data.status === 404) {
    block.innerHTML = '<h1>404 Not Found</h1>';
    return false;
  }

  const {
    title,
    description,
    publisheddate,
    category,
  } = data;

  const html = `
    <div class="event-article">
      <div>${title}</div>
      <div>${description}</div>
      <div>Published: ${publisheddate}</div>
      <div">Category: ${category}</div>
    </div>`;

  block.innerHTML = html;
  return true;
}
