import fs from 'node:fs';
import path from 'node:path';

const POSTS_PATH = path.resolve('data/posts.json');

async function translateViToEn(text) {
    if (!text) return '';
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=vi|en`;
        const res = await fetch(url);
        if (!res.ok) return text;
        const data = await res.json();
        const translated = data?.responseData?.translatedText;
        return translated && data.responseStatus === 200 ? translated : text;
    } catch {
        return text;
    }
}

async function run() {
    const posts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf8'));
    let updated = false;

    for (const post of posts) {
        if (!post.vi) continue;
        if (!post.en) post.en = { title: '', summary: '' };

        if (!post.en.title && post.vi.title) {
            post.en.title = await translateViToEn(post.vi.title);
            updated = true;
        }
        if (!post.en.summary && post.vi.summary) {
            post.en.summary = await translateViToEn(post.vi.summary);
            updated = true;
        }
    }

    if (!updated) {
        console.log('All posts already have English translations.');
        return;
    }

    fs.writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 2) + '\n', 'utf8');
    console.log('Updated data/posts.json with English translations.');
}

run();
