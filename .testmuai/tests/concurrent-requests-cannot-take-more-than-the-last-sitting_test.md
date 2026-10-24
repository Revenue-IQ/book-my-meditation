---
assurance:
  id: t-1
  base: sha256:1a10ff9324bfecdfeebdab23f5a6be11dca74159137a1d6ab4d1d4ad34a52475
---
# Concurrent requests cannot take more than the last sitting place

> Two eligible Abhyasis attempt to book the same remaining place concurrently; the total bookings never exceed capacity.

## Step 1

At {{start_url}}, establish two independent signed-in browser sessions for Abhyasis {{abhyasi_a_login}} and {{abhyasi_b_login}} using {{abhyasi_a_password}} and {{abhyasi_b_password}}, each eligible for the same last available place in sitting {{race_slot}}.

## Step 2

capture baseline: booking state of sitting {{race_slot}} for both Abhyasis before the concurrent attempts

## Step 3 @verifies ac-1, ac-2, ac-7

In the two signed-in browser sessions, attempt to book the remaining place in sitting {{race_slot}} concurrently, then assert exactly one of these Abhyasis has a booking without preceptor approval, the other has no booking for that slot, and the slot's total booked places do not exceed its configured capacity.
