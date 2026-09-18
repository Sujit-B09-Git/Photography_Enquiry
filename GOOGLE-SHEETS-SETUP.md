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

Do not rename the form fields unless you also update `google-apps-script.gs`. If you edit the Apps Script later, create a new deployment version so the Web App uses the latest code.
