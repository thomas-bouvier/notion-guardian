import axios from "axios";
import extract from "extract-zip";
import { createWriteStream } from "fs";
import { rm, rmdir, mkdir, unlink, readdir, rename } from "fs/promises";
import { join } from "path";

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

async function moveFoldersContents(backupDir) {
  try {
    const files = await readdir(backupDir, { withFileTypes: true });

    for (const file of files) {
      const filePath = join(backupDir, file.name);

      if (file.isDirectory()) {
        await moveDirectoryContents(filePath, backupDir);
        console.log(`Moved contents of ${filePath} to ${backupDir}`);
        await rmdir(filePath)
      }
    }
  } catch (err) {
    console.error('Error reading directory:', err);
  }
}

async function moveDirectoryContents(sourceDir, destinationDir) {
  try {
    const files = await readdir(sourceDir);

    for (const file of files) {
      const sourceFile = join(sourceDir, file);
      const destinationFile = join(destinationDir, file);

      await rename(sourceFile, destinationFile);
    }
  } catch (err) {
    console.error(`Error moving contents of ${sourceDir}:`, err);
  }
}

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
  let fileTokenCookie;
  while (true) {
    await sleep(2);
    const {
      data: { results: tasks },
      headers: { 'set-cookie': getTasksRequestCookies },
    } = await client.post(`getTasks`, { taskIds: [taskId] });
    const task = tasks.find((t) => t.id === taskId);

    if (task.error) {
      console.error(`❌ Export failed with reason: ${task.error}`);
      process.exit(1);
    }

    console.log(`Exported ${task.status.pagesExported} pages.`);

    if (task.state === `success`) {
      exportURL = task.status.exportURL;
      fileTokenCookie = getTasksRequestCookies.find((cookie) =>
        cookie.includes("file_token="),
      );
      console.log(`\nExport finished.`);
      break;
    }
  }

  const response = await client({
    method: `GET`,
    url: exportURL,
    responseType: `stream`,
    headers: {
      Cookie: fileTokenCookie,
    },
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

  const files = await readdir(backupDir);
  for (const file of files) {
    const filePath = join(backupDir, file)
    await extract(filePath, { dir: backupDir })
    await unlink(filePath)
  }
  moveFoldersContents(backupDir)

  console.log(`✅ Export downloaded and unzipped.`);
};

run();
