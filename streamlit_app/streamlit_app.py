import streamlit as st
import base64
import numpy as np
from PIL import Image
import threading
import time
import json
import websocket
import io
import queue

st.set_page_config(layout="wide")

st.title("Real-Time CV Dashboard")


# Session state for frame buffer
if 'frames' not in st.session_state:
    st.session_state['frames'] = []
if 'play' not in st.session_state:
    st.session_state['play'] = True
if 'show_detections' not in st.session_state:
    st.session_state['show_detections'] = True
if 'show_fatigue' not in st.session_state:
    st.session_state['show_fatigue'] = True
if 'show_goal_prob' not in st.session_state:
    st.session_state['show_goal_prob'] = True
if 'show_match_outcome' not in st.session_state:
    st.session_state['show_match_outcome'] = True
if 'show_movement_features' not in st.session_state:
    st.session_state['show_movement_features'] = True
if 'ws_thread_started' not in st.session_state:
    st.session_state['ws_thread_started'] = False


# UI Controls
col1, col2, col3 = st.columns([1,2,2])
with col1:
    if st.button("Play"):
        st.session_state['play'] = True
    if st.button("Pause"):
        st.session_state['play'] = False
with col2:
    if len(st.session_state['frames']) > 1:
        frame_idx = st.slider("Frame", 0, len(st.session_state['frames'])-1, 0)
    else:
        frame_idx = 0
        st.info("Waiting for frames...")
with col3:
    st.session_state['show_detections'] = st.checkbox("Show Detections", value=st.session_state['show_detections'])
    st.session_state['show_fatigue'] = st.checkbox("Show Fatigue", value=st.session_state['show_fatigue'])
    st.session_state['show_goal_prob'] = st.checkbox("Show Goal Prob", value=st.session_state['show_goal_prob'])
    st.session_state['show_match_outcome'] = st.checkbox("Show Match Outcome", value=st.session_state['show_match_outcome'])
    st.session_state['show_movement_features'] = st.checkbox("Show Movement Features", value=st.session_state['show_movement_features'])



# Global queue for inter-thread communication
frame_queue = queue.Queue()

def on_message(ws, message):
    data = json.loads(message)
    print(f"Received message of type: {data.get('type')}")
    if data.get('type') == 'frame':
        frame_queue.put(data)
    elif data.get('type') == 'llm_summary':
        frame_queue.put({'type': 'llm_summary', 'data': data})

def ws_thread():
    ws = websocket.WebSocketApp(
        "ws://localhost:8765",
        on_message=on_message
    )
    ws.run_forever()

if not st.session_state['ws_thread_started']:
    threading.Thread(target=ws_thread, daemon=True).start()
    st.session_state['ws_thread_started'] = True

# Main thread: move frames from global queue to session_state['frames']
def process_frame_queue():
    while not frame_queue.empty():
        item = frame_queue.get()
        if isinstance(item, dict) and item.get('type') == 'llm_summary':
            if st.session_state['frames']:
                st.session_state['frames'][-1]['llm_summary'] = item['data']
        else:
            st.session_state['frames'].append(item)
            if len(st.session_state['frames']) > 300:
                st.session_state['frames'] = st.session_state['frames'][-300:]

process_frame_queue()


# Force Streamlit to rerun every 200ms for live updates
st_autorefresh = st.experimental_rerun if hasattr(st, 'experimental_rerun') else None
if 'autorefresh_counter' not in st.session_state:
    st.session_state['autorefresh_counter'] = 0
if st_autorefresh:
    time.sleep(0.2)
    st.session_state['autorefresh_counter'] += 1
    if st.session_state['autorefresh_counter'] < 100000:
        st.experimental_rerun()

# Video display with overlays and error handling
if st.session_state['frames']:
    frame_data = st.session_state['frames'][frame_idx]
    print(f"Displaying frame {frame_data['frame_id']} with data keys: {list(frame_data.keys())}")
    try:
        img_b64 = frame_data['image']
        st.write(f"Image base64 length: {len(img_b64)}")
        st.write(f"Image base64 head: {img_b64[:100]}")
        img_bytes = base64.b64decode(img_b64)
        st.write(f"Image bytes length: {len(img_bytes)}")
        img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        # Draw overlays using PIL
        import PIL.ImageDraw
        draw = PIL.ImageDraw.Draw(img)
        # Draw detections (bounding boxes)
        if st.session_state['show_detections'] and 'detections' in frame_data:
            for det in frame_data['detections']:
                bbox = det.get('bbox', [0,0,0,0])
                draw.rectangle(bbox, outline='red', width=2)
                draw.text((bbox[0], bbox[1]), f"{det.get('id','')}:{det.get('confidence',0):.2f}", fill='red')
        # Draw fatigue overlay
        if st.session_state['show_fatigue'] and 'fatigue' in frame_data:
            draw.text((10, 10), f"Fatigue: {frame_data['fatigue']}", fill='blue')
        # Draw goal probability overlay
        if st.session_state['show_goal_prob'] and 'goal_prob' in frame_data:
            draw.text((10, 30), f"Goal Prob: {frame_data['goal_prob']}", fill='green')
        # Draw match outcome overlay
        if st.session_state['show_match_outcome'] and 'match_outcome' in frame_data:
            draw.text((10, 50), f"Match Outcome: {frame_data['match_outcome']}", fill='purple')
        # Draw movement features overlay
        if st.session_state['show_movement_features'] and 'movement_features' in frame_data:
            draw.text((10, 70), f"Movement: {frame_data['movement_features']}", fill='orange')
        st.image(img, caption=f"Frame {frame_data['frame_id']}")
    except Exception as e:
        st.error(f"Error decoding or displaying image: {e}")
        st.write(f"Image base64 length: {len(frame_data.get('image',''))}")
        st.write(f"Image base64 head: {frame_data.get('image','')[:100]}")
        # Show a placeholder image if decoding fails
        st.image(np.zeros((100,100,3), dtype=np.uint8), caption="Placeholder: failed to decode image")


# Analytics panel
with st.expander("Analytics Panel", expanded=True):
    st.write(f"Frame ID: {frame_data['frame_id'] if st.session_state['frames'] else '-'}")
    st.write(f"FPS: {frame_data.get('fps', '-') if st.session_state['frames'] else '-'}")
    st.write(f"Player count: {len(frame_data.get('detections', [])) if st.session_state['frames'] else '-'}")
    st.write(f"Fatigue: {frame_data.get('fatigue', '-') if st.session_state['frames'] else '-'}")
    st.write(f"Goal Prob: {frame_data.get('goal_prob', '-') if st.session_state['frames'] else '-'}")
    st.write(f"Match Outcome: {frame_data.get('match_outcome', '-') if st.session_state['frames'] else '-'}")
    st.write(f"Movement Features: {frame_data.get('movement_features', '-') if st.session_state['frames'] else '-'}")
    st.write("Event log:")
    st.table(frame_data.get('events', []) if st.session_state['frames'] else [])


# LLM summary panel - For Later
with st.expander("LLM Summary - For Later", expanded=True):
    st.subheader("LLM Summary")
    st.write(frame_data.get('llm_summary', {}).get('text', '') if st.session_state['frames'] else '')
