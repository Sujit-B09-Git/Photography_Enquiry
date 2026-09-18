# Connect the enquiry form to Google Sheets

1. Create or open the Google Sheet that should receive enquiries.
2. In the Sheet, choose **Extensions → Apps Script**.
3. Replace the editor contents with `google-apps-script.gs` from this folder and save.
4. Choose **Deploy → New deployment → Web app**.
5. Set **Execute as** to **Me** and **Who has access** to **Anyone**, then deploy and authorize it.
6. Copy the `/exec` Web App URL.
7. Paste that URL between the quotes in `dist/config.js`:

   ```js
   window.SPF_CONFIG = {
     googleScriptUrl: "YOUR_WEB_APP_EXEC_URL"
   };
   ```

8. Republish the site. The script creates an `Enquiries` tab and column headings the first time a valid enquiry arrives.

## New-enquiry notifications

After an enquiry is successfully saved, the script can send both an email and a Telegram message. Notification failures are logged and never remove the saved enquiry or make the client submit it again.

### 1. Add the required Script Properties

Open **Apps Script → Project Settings → Script properties**, then add these three properties:

- `OWNER_EMAIL`: the email address that should receive enquiry alerts.
- `TELEGRAM_BOT_TOKEN`: the token generated for your Telegram bot.
- `TELEGRAM_CHAT_ID`: the private chat, group, or channel ID that should receive alerts.

Do not paste these values into `google-apps-script.gs`, `dist/config.js`, or any other repository file.

### 2. Create the Telegram bot

1. In Telegram, open the official **@BotFather** account.
2. Send `/newbot` and follow the prompts.
3. Copy the generated bot token into the `TELEGRAM_BOT_TOKEN` Script Property.
4. Open the new bot's chat and send it any message. For a group, add the bot to the group and send a message in that group.

### 3. Find the Telegram chat ID

1. In the Apps Script editor, select `getTelegramChatId` from the function menu.
2. Click **Run** and approve the requested external-request permission.
3. Open **Execution log** and find the latest `result` entry.
4. Copy the value under `message → chat → id` into the `TELEGRAM_CHAT_ID` Script Property. Group IDs can begin with a minus sign.
5. If `result` is empty, send another message to the bot and run `getTelegramChatId` again.

### 4. Test both notifications

1. Select `testNotifications` in the Apps Script function menu.
2. Click **Run** and approve the email permission if requested.
3. Confirm that the owner email and Telegram chat both receive the test alert.

### 5. Activate the updated web app

1. Choose **Deploy → Manage deployments**.
2. Edit the current web-app deployment.
3. Select **New version**, then click **Deploy**.
4. Keep the existing `/exec` URL in `dist/config.js`; it does not need to change.

Do not rename the form fields unless you also update `google-apps-script.gs`. If you edit the Apps Script later, create a new deployment version so the Web App uses the latest code.
