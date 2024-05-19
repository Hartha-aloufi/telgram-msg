import puppeteer from 'puppeteer';

// Telegram message structure classes
// full msg date : .time-inner
// scroll container: .bubbles .scrollable.scrollable-y
// msg: .translatable-message
// msg container: .bubble
// msg id: data-mid

const channel = 'AjaNews';

const parseRenderedMessages = async (page) => {
    // read telegram messages
    return page.evaluate(() => {
        // get all message container
        const messages = document.querySelectorAll('.bubble.channel-post')
        // get all messages
        return messagesArray = Array.from(messages).map(message => {
            // get message text
            const text = message.querySelector('.translatable-message').innerText;
            const date = message.querySelector('.time-inner').innerText;
            const id = message.getAttribute('data-mid');

            return {
                text,
                date,
                id
            }
        });
    });
}
const getMessages = async () => {
    // Start a Puppeteer session with:
    // - a visible browser (`headless: false` - easier to debug because you'll see the browser in action)
    // - no default viewport (`defaultViewport: null` - website page will in full width and height)
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: [
            '--user-data-dir=%userprofile%\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 1',
            // '--profile-directory=Profile 1'
        ]

    });

    // Open a new page
    const page = await browser.newPage();


    // On this new page:
    // - open the "http://quotes.toscrape.com/" website
    // - wait until the dom content is loaded (HTML is ready)
    await page.goto(`https://web.telegram.org/k/#@${channel}`, {
        waitUntil: "networkidle0",
    });
    // make sure .bubbles-inner is loaded
    await page.waitForSelector('.bubbles-inner');

    console.log('Page is ready!')

    // scroll 10 times
    for (let i = 0; i < 10; i++) {
        const scrollable = await page.select('.bubbles-inner');
        console.log('sssssssssssssssssssssssssssss', scrollable.scrollTop, scrollable.scrollHeight);
        scrollable.scrollTop = scrollable.scrollHeight;

        await page.waitForNetworkIdle()
    }

    // get all messages
    const messages = await parseRenderedMessages(page);


    console.log('Messages:', messages.length);
    console.log(messages);
};


getMessages();