import { NextResponse } from 'next/server';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
export const json = (data, status = 200) => NextResponse.json(data, { status, headers: CORS });
export const options = () => new NextResponse(null, { status: 204, headers: CORS });
