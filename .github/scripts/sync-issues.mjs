import fs from 'node:fs';
import path from 'node:path';

const POSTS_PATH = path.resolve('data/posts.json');
const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GITHUB_TOKEN;

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

async function fetchIssues() {
    const res = await fetch(`https://api.github.com/repos/${REPO}/issues?state=open&per_page=100`, {
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'sync-issues-script'
        }
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch issues: ${res.status} ${res.statusText}`);
    }
    const items = await res.json();
    return items.filter(item => !item.pull_request);
}

async function run() {
    if (!REPO || !TOKEN) {
        throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required.');
    }

    const existingPosts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf8'));
    const postsMap = new Map(existingPosts.map(p => [p.id, p]));

    const issues = await fetchIssues();
    let syncedCount = 0;

    for (const issue of issues) {
        const labelNames = issue.labels.map(l => l.name.toLowerCase());
        let type = null;
        if (labelNames.includes('blog')) type = 'blog';
        else if (labelNames.includes('project') || labelNames.includes('projects')) type = 'project';
        else if (labelNames.includes('about')) type = 'about';
        if (!type) continue;

        const rawBody = issue.body || '';
        const dateMatch = rawBody.match(/^date:\s*(\d{4}-\d{2}-\d{2})\s*$/im);
        const postDate = dateMatch ? dateMatch[1] : issue.created_at.slice(0, 10);

        const viTitle = issue.title.trim();
        const viSummary = rawBody
            .replace(/^date:.*$/im, '')
            .trim();
        const [enTitle, enSummary] = await Promise.all([
            translateViToEn(viTitle),
            translateViToEn(viSummary)
        ]);

        const id = `issue-${issue.number}`;
        postsMap.set(id, {
            id,
            type,
            date: postDate,
            vi: { title: viTitle, summary: viSummary },
            en: { title: enTitle, summary: enSummary }
        });
        syncedCount++;
    }

    const mergedPosts = Array.from(postsMap.values()).sort((a, b) =>
        b.date.localeCompare(a.date)
    );

    const nextJson = JSON.stringify(mergedPosts, null, 2) + '\n';
    const prevJson = fs.readFileSync(POSTS_PATH, 'utf8');
    if (nextJson === prevJson) {
        console.log('No changes to data/posts.json.');
        return;
    }

    fs.writeFileSync(POSTS_PATH, nextJson, 'utf8');
    console.log(`Synced ${syncedCount} issue post(s) into data/posts.json.`);
}

run();
