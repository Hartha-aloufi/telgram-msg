import puppeteer from 'puppeteer';

import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';

// Telegram message structure classes
// full msg date : .time-inner
// scroll container: .bubbles .scrollable.scrollable-y
// msg: .translatable-message
// msg container: .bubble
// msg id: data-mid

const channel = 'TwfanJordan';



const createBrowser = () => {
    // Start a Puppeteer session with:
    // - a visible browser (`headless: false` - easier to debug because you'll see the browser in action)
    // - no default viewport (`defaultViewport: null` - website page will in full width and height)
    return puppeteer.launch({
        headless: false,
        devtools: false,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: [
            '--user-data-dir=%userprofile%\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 1',
            // '--profile-directory=Profile 1'
        ]
    });
}

const openTChannel = async (browser) => {
    // Open a new page
    const page = await browser.newPage();


    // On this new page:
    // - open the "http://quotes.toscrape.com/" website
    // - wait until the dom content is loaded (HTML is ready)
    page.goto(`https://web.telegram.org/k/#@${channel}`, {
        waitUntil: "networkidle0",
    });

    return page
}

const waitForPageLoad = async (page) => {
    // make sure .bubbles-inner is loaded
    await page.waitForSelector('.translatable-message');

    console.log('Page is ready!')
}

const loadMessages = async (page) => {
    let noMoreCount = 0;

    while (true) {
        try {
            // scroll to top to load more messages
            await page.evaluate((divSelector) => {
                const msgContainer = document.querySelector(divSelector);
                console.log('scroll top', msgContainer.scrollTop)

                if (msgContainer.scrollTop === 0) {
                    throw new Error('Maybe no more messages');
                }
                msgContainer.scrollTop = 0; // Scroll to the top of the div

            }, '.bubbles .scrollable.scrollable-y');

            // exit loop if we scroll to the top
            break;
        } catch (error) {
            if (error.message === 'Maybe no more messages') {
                noMoreCount++;
                console.log('no more count', noMoreCount)

                if (noMoreCount > 300) {
                    // break if no more messages to load
                    throw new Error('No more messages to load');
                }

                // try to wait for network idle
                try {
                    await page.waitForNetworkIdle({ timeout: 300 });
                } catch (error) {
                }
            }
        }
    }
}

/**
 * 
 * @param {*} page 
 * @param {*} firstMsgId 
 * @returns 
 */
const parseRenderedMessages = async (page, firstMsgId) => {
    // read telegram messages
    return page.evaluate((firstMsgId) => {
        let newfirstMsgId = null;

        // get all message container
        const messagesElements = Array.from(document.querySelectorAll('.bubble.channel-post'))
        const firstMsgIdx = messagesElements.findIndex(message => message.getAttribute('data-mid') == firstMsgId)

        // get all messages
        const messagesArray = messagesElements
            .slice(0, firstMsgIdx === -1 ? messagesElements.length : firstMsgIdx)
            .map((message, idx) => {
                if (!message.querySelector('.translatable-message')) {
                    return null
                }
                // get message text
                const text = message.querySelector('.translatable-message').innerText;
                let date = message.querySelector('.time-inner').getAttribute('title');
                const id = message.getAttribute('data-mid');

                if (date.includes('Edited:')) {
                    date = date.split('Edited:')[0].trim();
                }


                if (idx === 0) {
                    newfirstMsgId = id;
                }
                return {
                    text,
                    date,
                    id
                }
            });

        return { messages: messagesArray, firstMsgId: newfirstMsgId || firstMsgId };
    }, firstMsgId);
}

const readAllNeeded = (lastReaddMsgDate, targetDate = '2023-10-04T00:00:00') => {
    if (!lastReaddMsgDate) {
        return false;
    }

    // check if the first message date is after 04 Oct 2023, 00:00:00
    const firstMsgDate = new Date(lastReaddMsgDate);
    if (firstMsgDate < new Date(targetDate)) {
        return true;
    }

    return false
}

const removeDeduplicateMessages = (messages) => {
    // check if there is any redundant message using id and new Set
    // create set
    const idSet = new Set(messages.map(m => m.id));
    console.log('redundant messages', messages.length - idSet.size);
    // convert set to array
    return [...idSet].map(id => messages.find(m => m.id === id));
}

const writeMessagesToCsv = (messages, fileName) => {
    const filePath = `${fileName}.csv`;


    // Create CSV writer
    const csvWriter = createCsvWriter({
        path: filePath,
        header: [
            { id: 'id', title: 'ID' },
            { id: 'date', title: 'Date' },
            { id: 'text', title: 'Text' }
        ]
    });

    // Write the combined data to the CSV file
    return csvWriter.writeRecords(messages);
};

const pullChannelMessages = async () => {
    const browser = await createBrowser();
    const page = await openTChannel(browser)
    await waitForPageLoad(page)

    let messages = []
    let firstMsgId = null;

    while (!readAllNeeded(messages[0]?.date)) {
        try {
            await loadMessages(page);
        } catch (e) {
            if (e.message !== 'No more messages to load')
                break;

            throw e;
        }

        console.log('New batch of messages loaded')
        const data = await parseRenderedMessages(page, firstMsgId);
        console.log(`New batch of ${data.messages.length} messages parsed`)

        // append messages
        messages = [...data.messages.filter(msg => !!msg), ...messages];
        // get the id of the last message, will use it to read the next batch of messages
        firstMsgId = data.firstMsgId;
    }

    const firstMsgDate = messages[0].date;
    const csvFileName = `${channel}_${firstMsgDate}`;
    return writeMessagesToCsv(removeDeduplicateMessages(messages), csvFileName)
}


pullChannelMessages().then(() => {
    console.log('Done!')
}).catch((error) => {
    console.error('Error:', error);
});