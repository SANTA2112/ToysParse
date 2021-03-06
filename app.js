const puppeteer = require('puppeteer');
const fs = require('fs');
const categories = require('./links.json')
const ROOT_URL = 'https://rc-go.ru/';

let data = [];

const wait = ms => new Promise(done => setTimeout(done, ms));

(async ()=>{
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS || false,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();

  if (categories.length == 0) {
    await page.goto(ROOT_URL, {waitUntil: 'networkidle2'});
    let categories = await page.evaluate(() => {
      const links = [...document.querySelectorAll('.vertical-menu-list a')];
      return links.map(link => ({
        name: link.children[1].textContent,
        link: link.href
      }))
    })
    categories = categories.filter(c => c.name != 'Машины');
    categories.push({ name: 'Радиоуправляемые модели машин электро', link: 'https://rc-go.ru/cat/radioupravlyaemie-modeli-mashin-elektro/' })
    categories.push({ name: 'Радиоуправляемые модели машин с ДВС, бензиновые и нитро', link: 'https://rc-go.ru/cat/radioupravlyaemie-modeli-mashin-s-dvs-benzinovie-i-nitro/' })
    categories.push({ name: 'Машинки на пульте', link: 'https://rc-go.ru/cat/mashinki-na-pulte/' })
    categories = await Promise.all(categories.map(async (category, i) => {
      await wait(i * 2000);
      const p = await browser.newPage();
      await p.goto(category.link, {waitUntil: 'networkidle2'});
      const subcategories = await p.evaluate(() => {
        let subcategories = [...document.querySelectorAll('.cat-short-desc-products li h5 a')]
          .map(link => ({ name: link.textContent, link: link.href }))
        return subcategories
      });
      category.subcategories = subcategories;
      p.close()
      return category
    }))
    fs.writeFile('./links.json', JSON.stringify(categories, '', 2), () => {console.log('data saved!')})
  }
  console.time('Время выполнения: ');
  for(let i = 0; i < categories.length; i++) {
    for(let j = 0; j < categories[i].subcategories.length; j++) {
      console.log(`Category (${i+1}/${categories.length}) - Subcategory (${j+1}/${categories[i].subcategories.length})`)
      await page.goto(categories[i].subcategories[j].link, {waitUntil: 'networkidle2'});
      let next;
      do {
        const temp = await page.evaluate((category, subcategory) => {
          const items = [...document.querySelectorAll('.item_table')];
          const products = items.map(item => {
            let name, price, manufacter, description, article, img;
            try {
              name = item.querySelector('.add-prod-name').textContent;
              price = item.querySelector('.curr-price').childNodes[0].textContent;
              manufacter = item.querySelector('.add-prod-center div a').textContent;
              article = item.querySelector('.add-prod-center div').childNodes[7].textContent.trim();
              description = item.querySelector('.add-prod-center div').childNodes[9].textContent.trim();
              img = item.querySelector('.add-prod-img img').src;
            } catch(e) { console.log(e) }
            return ({ name, price, manufacter, description, article, img, category, subcategory })
          })
          return products
        }, categories[i].name, categories[i].subcategories[j].name);
        data = [...data, ...temp];
        next = await page.$('.pagination a[aria-label=Next]');
        if (next) {
          await next.click();
          await page.waitFor('footer');
        }
      } while (next)
    }
  }
  console.timeEnd('Время выполнения: ');
  fs.writeFile('./products.json', JSON.stringify(data, '', 2), () => {console.log('All fucking DONE!')})
})()
