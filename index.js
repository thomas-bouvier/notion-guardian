const axios = require(`axios`);
const extract = require(`extract-zip`);
const { createWriteStream } = require(`fs`);
const { rm, mkdir, unlink } = require(`fs/promises`);
const { join } = require(`path`);

const notionAPI = `https://www.notion.so/api/v3`;
const { NOTION_TOKEN, NOTION_SPACE_ID, NOTION_USER_ID } = process.env;
const client = axios.create({
  baseURL: notionAPI,
  headers: {
    Cookie: `token_v2=${NOTION_TOKEN};`,
    "x-notion-active-user-header": NOTION_USER_ID,
  },
});

if (!NOTION_TOKEN || !NOTION_SPACE_ID || !NOTION_USER_ID) {
  console.error(
    `Environment variable NOTION_TOKEN, NOTION_SPACE_ID or NOTION_USER_ID is missing. Check the README.md for more information.`
  );
  process.exit(1);
}

const sleep = async (seconds) => {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
};

const round = (number) => Math.round(number * 100) / 100;

const exportFromNotion = async (destination, format) => {
  const task = {
    eventName: `exportSpace`,
    request: {
      spaceId: NOTION_SPACE_ID,
      exportOptions: {
        exportType: format,
        timeZone: `Europe/Paris`,
        locale: `en`,
      },
    },
  };
  const {
    data: { taskId },
  } = await client.post(`enqueueTask`, { task });

  console.log(`Started Export as task [${taskId}].\n`);

  let exportURL;
  while (true) {
    await sleep(2);
    const {
      data: { results: tasks },
    } = await client.post(`getTasks`, { taskIds: [taskId] });
    const task = tasks.find((t) => t.id === taskId);

    if (task.error) {
      console.error(`❌ Export failed with reason: ${task.error}`);
      process.exit(1);
    }

    console.log(`Exported ${task.status.pagesExported} pages.`);

    if (task.state === `success`) {
      exportURL = task.status.exportURL;
      console.log(`\nExport finished.`);
      break;
    }
  }

  const response = await client({
    method: `GET`,
    url: exportURL,
    responseType: `stream`,
  });

  const size = response.headers["content-length"];
  console.log(`Downloading ${round(size / 1000 / 1000)}mb...`);

  const stream = response.data.pipe(createWriteStream(destination));
  await new Promise((resolve, reject) => {
    stream.on(`close`, resolve);
    stream.on(`error`, reject);
  });
};

const run = async () => {
  const backupDir = join(process.cwd(), `backup`);
  const backupZip = join(process.cwd(), `backup.zip`);

  await exportFromNotion(backupZip, `markdown`);
  await rm(backupDir, { recursive: true, force: true });
  await mkdir(backupDir, { recursive: true });
  await extract(backupZip, { dir: backupDir });
  await unlink(backupZip);

  console.log(`✅ Export downloaded and unzipped.`);
};

run();
