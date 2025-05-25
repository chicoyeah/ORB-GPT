import tkinter as tk
import random
import requests
import webbrowser
import threading
import io
import json
import os
from PIL import Image, ImageTk

# === CONFIG ===
CONFIG_FILE = "osu_credentials.json"
NUM_ATTEMPTS = 15

# Globals
current_url = ""
current_map_id = ""
current_thumbnail_photo = None
mode_vars = {}
selected_min_rating = 0.0
selected_max_rating = 10.0
loading = False
mode_map = {0: "osu", 1: "taiko", 2: "fruits", 3: "mania"}

# === CREDENTIALS ===
def load_credentials():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)
                return data.get("client_id"), data.get("client_secret")
        except:
            return None, None
    return None, None

def save_credentials(cid, secret):
    with open(CONFIG_FILE, "w") as f:
        json.dump({"client_id": cid, "client_secret": secret}, f)

OSU_CLIENT_ID, OSU_CLIENT_SECRET = load_credentials()

# === API ===
def get_osu_token():
    try:
        res = requests.post(
            "https://osu.ppy.sh/oauth/token",
            json={"client_id": OSU_CLIENT_ID,
                  "client_secret": OSU_CLIENT_SECRET,
                  "grant_type": "client_credentials",
                  "scope": "public"}, timeout=10)
        res.raise_for_status()
        return res.json().get('access_token')
    except:
        return None


def fetch_map_by_id(random_id, token):
    if not loading:
        return None
    try:
        res = requests.get(f"https://osu.ppy.sh/api/v2/beatmapsets/{random_id}",
                           headers={"Authorization": f"Bearer {token}"}, timeout=10)
        res.raise_for_status()
        data = res.json()
        if data.get('status') not in ['ranked', 'loved', 'qualified', 'approved']:
            return None
        valid = []
        for b in data.get('beatmaps', []):
            mode_str = mode_map.get(b.get('mode_int'))
            rating = b.get('difficulty_rating', 0)
            if (mode_str in mode_vars and mode_vars[mode_str].get() and
                    selected_min_rating <= rating <= selected_max_rating):
                valid.append((b, mode_str))
        if not valid:
            return None
        bm, mode_str = valid[0]
        title = data.get('title', 'N/A')
        artist = data.get('artist', 'N/A')
        status = data.get('status', 'N/A').capitalize()
        rating = round(bm.get('difficulty_rating', 0), 2)
        map_id = data.get('id')
        url = f"https://osu.ppy.sh/beatmapsets/{map_id}"
        thumb = data.get('covers', {}).get('cover@2x') or data.get('covers', {}).get('cover')
        display_title = f"{title} [{artist}] ({status}, {mode_str.capitalize()}) - {rating}★"
        return display_title, url, str(map_id), thumb
    except:
        return None


def get_random_map(token):
    while loading:
        threads = []
        results = []
        def attempt():
            if not loading:
                return
            r = fetch_map_by_id(random.randint(1, 3000000), token)
            if r:
                results.append(r)
        for _ in range(NUM_ATTEMPTS):
            t = threading.Thread(target=attempt, daemon=True)
            t.start(); threads.append(t)
        for t in threads:
            t.join(timeout=5)
        if results:
            return results[0]
    return None

# === GUI UPDATE ===
def show_feedback(msg):
    feedback_label.config(text=msg)
    feedback_label.after(2000, lambda: feedback_label.config(text=""))


def open_map(event=None):
    if current_url:
        webbrowser.open(current_url)


def update_ui(title, url, thumbnail_bytes, map_id_str):
    global current_url, current_map_id, current_thumbnail_photo, loading
    current_url = url
    current_map_id = map_id_str
    status_label.config(text="")
    info_label.config(text=title)
    copy_link_btn.config(state="normal")
    copy_id_btn.config(state="normal")
    min_scale.config(state="normal")
    max_scale.config(state="normal")
    search_btn.config(text="Search Random Beatmap", state="normal")
    loading = False
    if thumbnail_bytes:
        try:
            img = Image.open(io.BytesIO(thumbnail_bytes))
            img.thumbnail((450, 300), Image.Resampling.LANCZOS)
            current_thumbnail_photo = ImageTk.PhotoImage(img)
            thumbnail_label.config(image=current_thumbnail_photo, text="")
            thumbnail_label.image = current_thumbnail_photo
        except:
            thumbnail_label.config(text="Thumbnail N/A", image="")
    else:
        thumbnail_label.config(text="Thumbnail N/A", image="")
    for widget in (result_frame, thumbnail_label, info_label):
        widget.unbind('<Button-1>')
        widget.bind('<Button-1>', open_map)


def fetch_and_display():
    token = get_osu_token()
    if not token:
        root.after(0, lambda: status_label.config(text="Failed to get API token"))
        root.after(0, lambda: update_ui("", "", None, ""))
        return
    res = get_random_map(token)
    if res and loading:
        title, url, mid, thumb_url = res
        t_bytes = None
        if thumb_url:
            try:
                r = requests.get(thumb_url, timeout=10)
                r.raise_for_status()
                t_bytes = r.content
            except:
                t_bytes = None
        root.after(0, update_ui, title, url, t_bytes, mid)
    else:
        root.after(0, lambda: update_ui("", "", None, ""))


def on_search():
    # Error if credentials missing
    if not OSU_CLIENT_ID or not OSU_CLIENT_SECRET:
     show_feedback("Missing osu! API credentials")
     return

    global selected_min_rating, selected_max_rating, loading
    if not any(var.get() for var in mode_vars.values()):
        show_feedback("Error: Select at least one mode")
        return
    if selected_max_rating < selected_min_rating:
        show_feedback("Error: Max stars < Min stars")
        return
    if selected_max_rating == selected_min_rating:
        show_feedback("Error: Max stars = Min stars")
        return
    if loading:
        loading = False
        return
    loading = True
    search_btn.config(text="Stop Search")
    min_scale.config(state="disabled")
    max_scale.config(state="disabled")
    status_label.config(text="Searching...")
    info_label.config(text="")
    thumbnail_label.config(image="", text="")
    copy_link_btn.config(state="disabled")
    copy_id_btn.config(state="disabled")
    threading.Thread(target=fetch_and_display, daemon=True).start()

# === CREDENTIALS WINDOW ===
def open_credentials_window():
    cred_win = tk.Toplevel(root)
    cred_win.title("osu! API Credentials")
    cred_win.configure(bg="#282c34")
    cred_win.geometry("400x220")

    tk.Label(cred_win, text="osu! Client ID:", fg="white", bg="#282c34").pack(pady=(10, 2))
    cid_entry = tk.Entry(cred_win, width=30)
    cid_entry.pack(pady=5)

    tk.Label(cred_win, text="osu! Client Secret:", fg="white", bg="#282c34").pack(pady=(10, 2))
    secret_entry = tk.Entry(cred_win, width=30, show="*")
    secret_entry.pack(pady=5)

    def open_osu_link(event):
        webbrowser.open("https://osu.ppy.sh/home/account/edit#new-oauth-application")

    link = tk.Label(cred_win, text="Get your Client ID and Secret here", fg="cyan", bg="#282c34", cursor="hand2")
    link.pack(pady=10)
    link.bind("<Button-1>", open_osu_link)

    def save():
        global OSU_CLIENT_ID, OSU_CLIENT_SECRET
        OSU_CLIENT_ID = cid_entry.get()
        OSU_CLIENT_SECRET = secret_entry.get()
        save_credentials(OSU_CLIENT_ID, OSU_CLIENT_SECRET)
        cred_win.destroy()

    tk.Button(cred_win, text="Save", command=save).pack(pady=10)

# === GUI SETUP ===
root = tk.Tk()
root.title("osu! Random Beatmap Finder")
root.configure(bg="#282c34")
root.resizable(False, False)
font = ("Segoe UI", 11)
main = tk.Frame(root, bg="#282c34", padx=20, pady=20)
main.pack()

cred_btn = tk.Button(main, text="Set osu! API Credentials", command=open_credentials_window,
                     font=("Segoe UI", 10), bg="#5c6370", fg="white", relief="flat")
cred_btn.pack(pady=(0,10))

mode_frame = tk.Frame(main, bg="#282c34")
mode_frame.pack(pady=5)
for m in ["osu", "taiko", "fruits", "mania"]:
    var = tk.BooleanVar(value=True)
    mode_vars[m] = var
    cb = tk.Checkbutton(mode_frame, text=m.capitalize(), variable=var,
                        bg="#282c34", fg="white", selectcolor="#3e4451",
                        activebackground="#282c34", activeforeground="white")
    cb.pack(side="left", padx=5)

rating_frame = tk.Frame(main, bg="#282c34")
rating_frame.pack(pady=5)

def on_min_rating(val):
    global selected_min_rating
    selected_min_rating = float(val)
    min_label.config(text=f"Min Stars: {selected_min_rating}")

def on_max_rating(val):
    global selected_max_rating
    val = float(val)
    if val >= 10.0:
        selected_max_rating = float('inf')
        max_label.config(text="Max Stars: ∞")
    else:
        selected_max_rating = val
        max_label.config(text=f"Max Stars: {selected_max_rating}")

min_label = tk.Label(rating_frame, text="Min Stars: 0.0", fg="white", bg="#282c34", font=font)
min_label.pack(side="left", padx=(0,10))
min_scale = tk.Scale(rating_frame, from_=0, to=10, resolution=0.1, orient="horizontal",
                     bg="#282c34", fg="white", highlightthickness=0,
                     command=on_min_rating, length=180)
min_scale.pack(side="left", padx=(0,20))

max_label = tk.Label(rating_frame, text="Max Stars: 10.0", fg="white", bg="#282c34", font=font)
max_label.pack(side="left", padx=(0,10))
max_scale = tk.Scale(rating_frame, from_=1, to=10, resolution=0.1, orient="horizontal",
                     bg="#282c34", fg="white", highlightthickness=0,
                     command=on_max_rating, length=180)
max_scale.set(10.0)
max_scale.pack(side="left")

search_btn = tk.Button(main, text="Search Random Beatmap", command=on_search,
                       font=("Segoe UI",12,"bold"), bg="#61afef", fg="white",
                       relief="flat", activebackground="#5298d1", activeforeground="white", pady=8)
search_btn.pack(pady=10)

status_label = tk.Label(main, text="", font=font, fg="orange", bg="#282c34")
status_label.pack()

result_frame = tk.Frame(main, bg="#3e4451", bd=2, relief="ridge", cursor="hand2")
result_frame.pack(pady=10, fill="x")
thumbnail_label = tk.Label(result_frame, bg="#3e4451", text="", font=font)
thumbnail_label.pack(pady=10)
info_label = tk.Label(result_frame, text="No map loaded.", font=font, fg="white", bg="#3e4451", wraplength=450)
info_label.pack(pady=5)

copy_frame = tk.Frame(main, bg="#282c34")
copy_frame.pack(pady=5)
copy_link_btn = tk.Button(copy_frame, text="Copy Link",
                          command=lambda: [root.clipboard_clear(), root.clipboard_append(current_url), show_feedback("Link copied!")],
                          font=("Segoe UI",10), bg="#4b5263", fg="white", relief="flat",
                          activebackground="#5c6370", activeforeground="white", state="disabled")
copy_link_btn.pack(side="left", padx=5)

copy_id_btn = tk.Button(copy_frame, text="Copy ID",
                        command=lambda: [root.clipboard_clear(), root.clipboard_append(current_map_id), show_feedback("ID copied!")],
                        font=("Segoe UI",10), bg="#4b5263", fg="white", relief="flat",
                        activebackground="#5c6370", activeforeground="white", state="disabled")
copy_id_btn.pack(side="left", padx=5)

feedback_label = tk.Label(main, text="", font=font, fg="#77dd77", bg="#282c34")
feedback_label.pack(pady=5)

root.mainloop()
