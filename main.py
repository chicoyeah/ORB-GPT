import tkinter as tk
import random
import requests
import webbrowser
import threading

# === CONFIG ===
OSU_CLIENT_ID = "your_cliend_id"
OSU_CLIENT_SECRET = "your_client_secret"
NUM_ATTEMPTS = 8

current_url = ""
loading_dots = 0
loading_running = False

def get_osu_token():
    url = "https://osu.ppy.sh/oauth/token"
    data = {
        "client_id": OSU_CLIENT_ID,
        "client_secret": OSU_CLIENT_SECRET,
        "grant_type": "client_credentials",
        "scope": "public"
    }
    res = requests.post(url, json=data)
    return res.json()['access_token']

def fetch_map_by_id(random_id, token):
    headers = {"Authorization": f"Bearer {token}"}
    url = f"https://osu.ppy.sh/api/v2/beatmapsets/{random_id}"
    try:
        res = requests.get(url, headers=headers)
        if res.status_code != 200:
            return None
        data = res.json()
        if data['status'] not in ['ranked', 'loved', 'qualified']:
            return None
        beatmaps = data.get('beatmaps', [])
        if any(b['mode'] == 'osu' for b in beatmaps):
            return f"{data['title']} [{data['artist']}] ({data['status']})", f"https://osu.ppy.sh/beatmapsets/{data['id']}"
    except:
        return None
    return None

def get_random_map(token):
    threads = []
    results = []

    def try_fetch():
        random_id = random.randint(1, 3_000_000)
        result = fetch_map_by_id(random_id, token)
        if result:
            results.append(result)

    for _ in range(NUM_ATTEMPTS):
        t = threading.Thread(target=try_fetch)
        t.start()
        threads.append(t)

    for t in threads:
        t.join()

    return results[0] if results else None

def animate_loading():
    global loading_dots, loading_running
    if loading_running:
        dots = '.' * (loading_dots % 4)
        loading_label.config(text=f"Searching{dots}")
        loading_dots += 1
        root.after(500, animate_loading)

def show_random_map():
    global loading_running, loading_dots
    loading_dots = 0
    loading_running = True
    button.config(state="disabled")
    animate_loading()
    threading.Thread(target=fetch_and_update_map).start()

def fetch_and_update_map():
    token = get_osu_token()
    while True:
        result = get_random_map(token)
        if result:
            root.after(0, update_interface, *result)
            break

def update_interface(title, url):
    global current_url, loading_running
    loading_running = False
    current_url = url
    loading_label.config(text="")
    result_label.config(text=title)
    link_label.config(text=url, fg="lightblue", cursor="hand2", wraplength=400, font=("Arial", 12))
    link_label.bind("<Button-1>", lambda e: webbrowser.open(url))
    button.config(state="normal")

def copy_link():
    if current_url:
        root.clipboard_clear()
        root.clipboard_append(current_url)
        show_feedback("Link Copied!")

def copy_id():
    if current_url:
        beatmap_id = current_url.rstrip("/").split("/")[-1]
        root.clipboard_clear()
        root.clipboard_append(beatmap_id)
        show_feedback("ID Copied!")

def show_feedback(message):
    feedback_label.config(text=message)
    feedback_label.after(1000, clear_feedback)

def clear_feedback():
    feedback_label.config(text="")

# === GUI ===
root = tk.Tk()
root.title("osu! Random Beatmap")
root.configure(bg="#2e2e2e")

font_style = ("Arial", 12)
button_font = ("Arial", 14)

button = tk.Button(root, text="Search Random Beatmap", command=show_random_map, font=button_font, bg="#444", fg="white", relief="flat")
button.pack(pady=20)

loading_label = tk.Label(root, text="", font=font_style, fg="gray", bg="#2e2e2e")
loading_label.pack(pady=10)

result_label = tk.Label(root, text="", font=font_style, wraplength=400, fg="white", bg="#2e2e2e")
result_label.pack(pady=10)

link_label = tk.Label(root, text="", font=font_style, fg="lightblue", cursor="hand2", bg="#2e2e2e")
link_label.pack(pady=10)

copy_buttons_frame = tk.Frame(root, bg="#2e2e2e")
copy_buttons_frame.pack(pady=5)

copy_link_btn = tk.Button(copy_buttons_frame, text="Copy Link", command=copy_link, bg="#444", fg="white", relief="flat")
copy_link_btn.pack(side="left", padx=10)

copy_id_btn = tk.Button(copy_buttons_frame, text="Copy ID", command=copy_id, bg="#444", fg="white", relief="flat")
copy_id_btn.pack(side="left", padx=10)

feedback_label = tk.Label(root, text="", font=font_style, fg="lightgreen", bg="#2e2e2e")
feedback_label.pack(pady=10)

root.mainloop()
