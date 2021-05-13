const puppeteer = require('puppeteer');
const fs = require('fs');
const config = require('./config.json');
const cookies = require('./cookies.json');
const loading =  require('loading-cli');
const comment_images = getFiles('assets/main');



(async () => {

    let browser = await puppeteer.launch({ headless: config.hideBrowser });
    const context = browser.defaultBrowserContext();
    await context.overridePermissions("https://www.facebook.com", []);
    let page = await browser.newPage();
    await page.setDefaultNavigationTimeout(100000);
    await page.setViewport({ width: 1200, height: 800 });


    // login
    await login();

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

        console.log('scraping:'+ fb_page);
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

        console.log(generated_links,generated_links.length)

        for (let i = 0; i < generated_links.length; i++){
            const generatedLink = generated_links[i];
            await page.goto(generatedLink,{ waitUntil: "networkidle2" });
            const load = loading("loading !!")
            console.log(generatedLink,i+1)

            let comment = pickRand(config.comments,null);
            // for (let comment of config.comments) {
            let text = "#tell_truth 🇵🇸\n\r" + (comment.source?comment.source+"\n\r":"")+ comment.comment;
            text += " #"+pickRand(config.hashtags)+ " #"+pickRand(config.hashtags)+ " #"+pickRand(config.hashtags)+ " #"+pickRand(config.hashtags);
            console.log(text)
            await page.evaluate(async (text)=>{
                // add rand hashtags to the comment
                document.querySelector("input[name='comment_text']").value=text; // find the submit button, enable it and click it
            },text);
            try {
                // upload photo if exist
                let comment_photo = "";
                if (comment.photo){
                    comment_photo = comment.photo;
                }else {
                    comment_photo = pickRand(comment_images,'');
                }
                if (fs.existsSync(comment_photo)) {
                    const elementHandle = await page.$("input[name=\"photo\"]");
                    await elementHandle.uploadFile(comment_photo);
                    // wait for upload file before submit
                    await page.waitForTimeout(9000);
                    await page.waitForSelector('[role="presentation"] img');

                     console.log('photo uploaded')
                }
            } catch(err) { console.error(err) }
                // click send!
            await page.evaluate(async ()=>{
                const submitButton = document.querySelector("button[name='submit']");
                submitButton.disabled = false;
                submitButton.click();
            })


                // delay before goto another post
                // await page.waitForTimeout(60000) // = 1 minute
            // }
            let waitTime = (60000+Math.floor((Math.random() * 2100)+1000));
            console.log('wait for->',waitTime/1000,'s')
            await page.waitForTimeout(waitTime) // = 1 minute

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
        await page.waitForTimeout(40000); // 20 sec
    }

    function pickRand(arr,suffix= "\n\r"){
        if (suffix == null){
            return arr[Math.floor(Math.random() * arr.length)];
        }
        return arr[Math.floor(Math.random() * arr.length)] + suffix;
    }

    function shuffle(array) {
        let currentIndex = array.length, temporaryValue, randomIndex;

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
    for (const fb_page of shuffle(config.pages)) {
        await tell_truth(fb_page);
    }

    console.log('done')





})();

function getFiles (dir, files_){
    files_ = files_ || [];
    let files = fs.readdirSync(dir);
    for (let i in files){
        let name = dir + '/' + files[i];
        if (fs.statSync(name).isDirectory()){
            getFiles(name, files_);
        } else {
            files_.push(name);
        }
    }
    return files_;
}