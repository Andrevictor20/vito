package handler

import _ "embed"

//go:embed templates/meeting_page.html
var meetingPageHTMLTemplate string

//go:embed templates/booking_page.html
var bookingPageHTMLTemplate string
