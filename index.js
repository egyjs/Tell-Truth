const puppeteer = require('puppeteer');
const fs = require('fs');
const config = require('./config.json');
const cookies = require('./cookies.json');
const loading =  require('loading-cli');



(async () => {

    let browser = await puppeteer.launch({ headless: config.hideBrowser });
    const context = browser.defaultBrowserContext();
    await context.overridePermissions("https://www.facebook.com", []);
    let page = await browser.newPage();
    await page.setDefaultNavigationTimeout(100000);
    await page.setViewport({ width: 1200, height: 800 });


    // login
    await login();

    shuffle(config.pages).forEach(fb_page => {
        tell_truth(fb_page)
    });



    async function login() {
        console.log('Login');
        if (!Object.keys(cookies).length) {
            await page.goto("https://www.facebook.com/login", { waitUntil: "networkidle2" });
            await page.type("#email", config.username, { delay: 30 })
            await page.type("#pass", config.password, { delay: 30 })
            await page.click("#loginbutton");
            await page.waitForNavigation({ waitUntil: "networkidle0" });
            let currentCookies = await page.cookies();
            fs.writeFileSync('./cookies.json', JSON.stringify(currentCookies,null,''));
        } else{
            //User Already Logged In
            console.log('User Already Logged In')
            await page.setCookie(...cookies);
            await page.goto("https://www.facebook.com/", { waitUntil: "networkidle2" });
        }
    }

    async function tell_truth(fb_page) {
        await page.goto(fb_page, { waitUntil: "networkidle2" });
        await autoScroll();
        let posts_selector = '[class="du4w35lb k4urcfbm l9j0dhe7 sjgh65i0"]'; // selector for posts
        await page.waitForSelector(posts_selector)
        let generated_links = await page.evaluate( (posts_selector)=>{
            let posts = document.querySelectorAll(posts_selector);
            let links = [];
            const regex = new RegExp("^https:\\/\\/www\\.facebook\\.com\\/([a-z0-9]+)\\/(posts)\\/([a-z.0-9]+)\\?", 'g');

            for (let j=0; j < posts.length; j++) {
                const anchors = posts[j].querySelectorAll('a');
                for(let i=0; i < anchors.length; i++){
                    links.push(anchors[i].href);
                }
            }

            let filtered_links = links.filter((link) => {
                return link.match(regex);
            });
            console.log(filtered_links)

            let mobile_links = [];
            for(let i=0; i < filtered_links.length; i++){
                const regex = /^https:\/\/www\.facebook\.com\/([a-z0-9]+)\/(posts|photos|videos)\/([a-z.0-9]+)\?/gm;
                const subst = `https://m.facebook.com/$1/$2/$3?`;

                mobile_links.push((filtered_links[i]).replace(regex, subst));
            }

            return mobile_links;
        },posts_selector);
        generated_links = shuffle(generated_links);
         for (let i = 0; i < generated_links.length; i++){
             const generatedLink = generated_links[i];
             await page.goto(generatedLink,{ waitUntil: "networkidle2" });
             console.log(generatedLink,i+1)

             let comment = "#tell_truth\n\r" + pickRand(config.comments);
             comment += " #"+pickRand(config.hashtags)+ " #"+pickRand(config.hashtags)+ " #"+pickRand(config.hashtags)+ " #"+pickRand(config.hashtags);
             console.log(comment)
             await page.evaluate(async (comment)=>{
                 // add rand hashtags to the comment
                 document.querySelector("input[name='comment_text']").value=comment; // find the submit button, enable it and click it
             },comment)
             try {
                 // upload photo if exist
                 let comment_photo = pickRand(config.images,'');
                 if (fs.existsSync(comment_photo)) {
                     const elementHandle = await page.$("input[name=\"photo\"]");
                     await elementHandle.uploadFile(comment_photo);
                     // wait for upload file before submit
                     await page.waitForSelector('[role="presentation"] img')
                     console.log('photo uploaded')
                 }
             } catch(err) { console.error(err) }

             // click send!
             await page.evaluate(async ()=>{
                 const submitButton = document.querySelector("button[name='submit']");
                 submitButton.disabled = false;
                 submitButton.click();
             })

             const load = loading("loading !!").start();

             setTimeout(async function(){
                 load.color = 'yellow';
                 load.text = ' Sleeeeping';
                 load.frame(["◰", "◳", "◲", "◱"]);
             },6000)


             // delay before goto another post
             await page.waitForTimeout(60000) // = 1 minute
             load.stop()
         }
    }


    // function to init the page scraping
    async function autoScroll() {
        await page.evaluate(async () => {
            window.scrollBy(0, window.innerHeight);

            let timesRun = 0;
            let interval = setInterval(function(){
                timesRun += 1;
                if(timesRun === 300){ // 150
                    clearInterval(interval);
                }
                window.scrollBy(0, window.innerHeight);
                console.log(timesRun)
            }, 200);

        });
        await page.waitForTimeout(20000); // 20 sec
    }

    function pickRand(arr,suffix= "\n\r"){
        return arr[Math.floor(Math.random() * arr.length)] + suffix
    }

    function shuffle(array) {
        var currentIndex = array.length, temporaryValue, randomIndex;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;

            // And swap it with the current element.
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }

        return array;
    }


})();

