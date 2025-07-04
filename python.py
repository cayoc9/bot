import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta


def body_message(name, time, numbers_send_or_groupId, *urgente):
    messages_data = []
    for groups in numbers_send_or_groupId:
        if urgente:
            messages_data.append({
                "number": groups,  # Agora usa o número atual do loop
                "message": f"({name}) - Urgente, sem cair logs a muito tempo",
            })
            continue
        messages_data.append({
            "number": groups,  # Agora usa o número atual do loop
            "message": f"({name}) - O último post foi feito há {time}",
        })
    return messages_data


def minutes(minutes, name, numbers_send_or_groupId):
    if "hora" in minutes:
        if int(minutes.split()[0]) >= 2:
            mensage_data = body_message(name, minutes, numbers_send_or_groupId)
            for message in mensage_data:
                requests.post("http://localhost:3000/send-message", json=message)
    elif "PM" in minutes or "AM" in minutes:
        mensage_data = body_message(name, minutes, numbers_send_or_groupId, True)
        for message in mensage_data:
            requests.post("http://localhost:3000/send-message", json=message)


send_numbers = [
    "120363391460631449@g.us",
    "559193315372@c.us"
]