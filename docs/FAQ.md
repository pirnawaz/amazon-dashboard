# FAQ (Seller Hub)

Frequently asked questions for operators and users.

## Why is my forecast empty?

- **No data yet:** Forecasts need order/sales history. If you have no Amazon data connected, use **Load sample data** on the Dashboard to explore the app with demo data.
- **Wrong marketplace:** Check the marketplace filter (e.g. US, UK, ALL) on the Forecast page and in Settings.
- **SKU mode:** In SKU mode you must select or enter a SKU that has history. Try **Total** mode first to see if any data exists.

## What does forecast quality mean?

The forecast quality badge summarizes how accurate the model has been recently (e.g. over the last 30 days). It uses metrics like MAE (Mean Absolute Error) and MAPE (Mean Absolute Percentage Error). Lower is better. Use it as a guide; forecasts are estimates, not guarantees.

## Is this real Amazon data?

- **Real data:** When your Amazon account is connected and synced, the app shows your real orders, inventory, and metrics (connection is not yet available; see Settings → Amazon Connections).
- **Demo data:** If you clicked **Load sample data** on the Dashboard, the app shows sample/demo data for exploration. It is clearly labeled as “Demo data” and can be cleared in Settings → Demo mode.

## Why is the Restock table empty?

- No restock recommendations for the selected period and marketplace. Try different **Days** or **Target days** or **Marketplace**.
- No inventory/order data yet. Load sample data from the Dashboard or connect your Amazon account when available.

## How do I clear demo data?

Go to **Settings** and use **Clear demo data** in the Demo mode section. You’ll be redirected to the Dashboard; real data will load when your account is connected.

## Where are my preferences stored?

Default marketplace, forecast horizon, lead time, and service level are stored in your browser (localStorage) and are not sent to the server. Clearing site data will reset them.
